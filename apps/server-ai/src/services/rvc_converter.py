from __future__ import annotations

import os
import sys
import time
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import torch

@dataclass
class _RVCPaths:
    rvc_root: Path
    assets_root: Path
    weight_root: Path
    hubert_path: Path
    rmvpe_root: Path


def _find_rvc_root_from_model(model_path: Path) -> Path:
    """Find RVC WebUI repo root by walking up from model_path.
    It expects the directory structure to include: infer/modules/vc/modules.py
    """
    cur = model_path.resolve()
    for _ in range(10):
        if cur.is_dir():
            cand = cur
        else:
            cand = cur.parent
        if (cand / "infer" / "modules" / "vc" / "modules.py").exists():
            return cand
        cur = cand.parent
    # Fallback: env
    env_root = os.getenv("RVC_WEBUI_ROOT")
    if env_root and Path(env_root).exists():
        return Path(env_root).resolve()
    raise FileNotFoundError(
        "RVC WebUI 루트를 찾지 못했습니다. model_path가 RVC WebUI 폴더 내부(또는 하위)에 있어야 합니다. "
        "또는 환경변수 RVC_WEBUI_ROOT=/path/to/Retrieval-based-Voice-Conversion-WebUI 를 설정하세요."
    )


def _build_paths(model_path: Path) -> _RVCPaths:
    rvc_root = _find_rvc_root_from_model(model_path)

    # assets 폴더는 사용자가 별도로 가지고 있을 수 있음 (zip에서 제외했다고 했음)
    # 우선순위: env RVC_ASSETS_ROOT > rvc_root/assets
    assets_root = Path(os.getenv("RVC_ASSETS_ROOT", str(rvc_root / "assets"))).resolve()
    if not assets_root.exists():
        raise FileNotFoundError(
            f"assets 폴더를 찾지 못했습니다: {assets_root}\n"
            f"assets가 다른 위치라면 환경변수 RVC_ASSETS_ROOT=/path/to/assets 로 지정하세요."
        )

    weight_root = model_path.parent.resolve()

    hubert_path = assets_root / "hubert" / "hubert_base.pt"
    if not hubert_path.exists():
        raise FileNotFoundError(
            f"HuBERT 가중치를 찾지 못했습니다: {hubert_path}\n"
            f"assets/hubert/hubert_base.pt 를 준비하세요."
        )

    rmvpe_root = assets_root / "rmvpe"
    # rmvpe는 f0_method=rmvpe일 때 필요. 없으면 harvest로 자동 fallback.
    return _RVCPaths(
        rvc_root=rvc_root,
        assets_root=assets_root,
        weight_root=weight_root,
        hubert_path=hubert_path,
        rmvpe_root=rmvpe_root,
    )


def _pcm16le_to_float32(pcm_bytes: bytes) -> np.ndarray:
    x = np.frombuffer(pcm_bytes, dtype=np.int16)
    return (x.astype(np.float32) / 32768.0).copy()


def _float32_to_pcm16le(x: np.ndarray) -> bytes:
    x = np.clip(x, -1.0, 1.0)
    y = (x * 32767.0).astype(np.int16)
    return y.tobytes()


def _resample(x: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
    if orig_sr == target_sr:
        return x
    # Prefer librosa (RVC WebUI가 이미 의존하는 경우가 많음)
    try:
        import librosa  # type: ignore

        return librosa.resample(x, orig_sr=orig_sr, target_sr=target_sr).astype(np.float32)
    except Exception:
        pass
    # Fallback: scipy
    try:
        from scipy.signal import resample_poly  # type: ignore

        # resample_poly expects integer factors; approximate with gcd
        import math

        g = math.gcd(orig_sr, target_sr)
        up = target_sr // g
        down = orig_sr // g
        return resample_poly(x, up, down).astype(np.float32)
    except Exception as e:
        raise RuntimeError(
            "리샘플러(librosa/scipy)가 없습니다. RVC 실행 환경에는 보통 포함되지만, "
            "없다면 librosa 또는 scipy를 설치하세요."
        ) from e


class RVCConverter:
    """
    RVC 모델을 사용한 음성 변환기

    역할:
    - RVC 모델 로딩
    - PCM 오디오 청크를 RVC로 변조
    - 실시간 스트리밍 처리 지원

    주의:
    - RVC WebUI(=Retrieval-based-Voice-Conversion-WebUI) 코드/의존성이 실행 환경에 존재해야 합니다.
    - assets 폴더(hubert/rmvpe 등)도 접근 가능해야 합니다.
    """

    def __init__(self, model_path: str, device: str = "cuda"):
        """
        Args:
            model_path: RVC 모델 파일 경로 (.pth)
            device: "cuda" 또는 "cpu"
        """
        self.model_path = Path(model_path).expanduser().resolve()
        self.device = device
        self._loaded = False

        # streaming context (16k domain)
        self._ctx_16k = np.zeros((0,), dtype=np.float32)
        self._ctx_samples_16k = int(os.getenv("RVC_STREAM_CONTEXT_MS", "200")) * 16  # 200ms default
        self._lock = threading.Lock()

        # RVC runtime objects
        self._paths: Optional[_RVCPaths] = None
        self._config = None
        self._vc = None

        # runtime knobs
        self._f0_method = os.getenv("RVC_F0_METHOD", "rmvpe")
        self._index_path = os.getenv("RVC_INDEX_PATH", "")
        self._index_rate = float(os.getenv("RVC_INDEX_RATE", "0.0"))
        self._pitch = int(os.getenv("RVC_PITCH", "0"))
        self._protect = float(os.getenv("RVC_PROTECT", "0.33"))
        self._rms_mix_rate = float(os.getenv("RVC_RMS_MIX_RATE", "1.0"))

    def load_model(self):
        """모델 로딩 (서버 시작 시 한 번 호출)"""
        with self._lock:
            if self._loaded:
                return

            if not self.model_path.exists():
                raise FileNotFoundError(f"model_path가 존재하지 않습니다: {self.model_path}")

            self._paths = _build_paths(self.model_path)

            # Make RVC importable
            sys.path.insert(0, str(self._paths.rvc_root))

            # IMPORTANT: RVC의 일부 경로는 상대경로(assets/...)를 가정하므로,
            # 실행 중 cwd를 RVC 루트로 맞춰둔다.
            os.chdir(str(self._paths.rvc_root))

            # env paths expected by RVC WebUI
            os.environ.setdefault("weight_root", str(self._paths.weight_root))
            os.environ.setdefault("index_root", str(self._paths.assets_root / "indices"))
            os.environ.setdefault("rmvpe_root", str(self._paths.rmvpe_root))

            # Imports from RVC WebUI
            from configs.config import Config  # type: ignore
            from infer.modules.vc.modules import VC  # type: ignore
            from infer.modules.vc.utils import load_hubert  # type: ignore

            config = Config()
            # override device / precision
            if self.device.lower().startswith("cuda"):
                config.device = "cuda:0"
                config.is_half = True
            else:
                config.device = "cpu"
                config.is_half = False

            #로그 찍기
            # print("[RVC] requested self.device =", self.device)
            # print("[RVC] config.device =", config.device, "is_half =", config.is_half, "cuda_available =", torch.cuda.is_available())
            # #####
            vc = VC(config)
            
            # #로그 찍기
            # print("[RVC] VC created. config.device =", config.device)
            ###############

            # Load generator/discriminator checkpoint and init pipeline/net_g
            sid = self.model_path.name
            vc.get_vc(sid)


            ###로그 찍기
            # try:
            #     print("[RVC] net_g device after get_vc =", next(vc.net_g.parameters()).device)
            # except Exception as e:
            #     print("[RVC] net_g device check failed:", e)

            #################

            # Load HuBERT
            #
            # NOTE: On newer PyTorch versions (2.6+), `torch.load` changed defaults
            # related to `weights_only` / safe unpickling. Some fairseq checkpoints
            # (like HuBERT) embed objects such as `fairseq.data.dictionary.Dictionary`,
            # which can trigger:
            #   _pickle.UnpicklingError: Weights only load failed ...
            #
            # RVC WebUI upstream may or may not have patched this depending on the
            # commit you use. We add a small compatibility retry here.
            try:
                vc.hubert_model = load_hubert(config)

                # 로그 찍기
                # try:
                #     print("[RVC] hubert device =", next(vc.hubert_model.parameters()).device)
                # except Exception as e:
                #     print("[RVC] hubert device check failed:", e)
                ##################################

            except Exception as e:
                msg = str(e)
                if ("Weights only load failed" in msg) or ("add_safe_globals" in msg) or ("safe_globals" in msg):
                    try:
                        # Allow-list the Dictionary class if fairseq is installed.
                        from fairseq.data.dictionary import Dictionary  # type: ignore

                        if hasattr(torch, "serialization") and hasattr(torch.serialization, "add_safe_globals"):
                            torch.serialization.add_safe_globals([Dictionary])
                    except Exception:
                        # If this fails, we still re-raise the original load error below.
                        pass
                    vc.hubert_model = load_hubert(config)
                else:
                    raise

            # warmup (optional)
            self._config = config
            self._vc = vc
            self._loaded = True

    def convert(self, pcm_bytes: bytes, sample_rate: int = 24000, channels: int = 1) -> bytes:
        """
        단일 오디오 청크를 RVC로 변조

        Args:
            pcm_bytes: PCM 오디오 바이트 (Int16, Little Endian)
            sample_rate: 24000 또는 16000
            channels: 1 (mono)

        Returns:
            변조된 PCM 바이트 (동일한 형식, 동일한 크기)
        """
        if channels != 1:
            raise ValueError("현재 구현은 mono(1채널)만 지원합니다.")

        if not self._loaded:
            raise RuntimeError("모델이 로딩되지 않았습니다. load_model()을 먼저 호출하세요.")

        assert self._vc is not None

        # 1) PCM -> float32 (input sr)
        x = _pcm16le_to_float32(pcm_bytes)
        in_samples = x.shape[0]

        # 2) resample input to 16k (RVC pipeline 기준)
        x16 = _resample(x, orig_sr=sample_rate, target_sr=16000)

        # 3) add context for smoother streaming
        with self._lock:
            if self._ctx_16k.size > 0:
                audio_16k = np.concatenate([self._ctx_16k, x16], axis=0)
            else:
                audio_16k = x16

            # update context for next call (keep tail of input domain)
            if self._ctx_samples_16k > 0:
                self._ctx_16k = audio_16k[-self._ctx_samples_16k :].astype(np.float32, copy=True)
            else:
                self._ctx_16k = np.zeros((0,), dtype=np.float32)

        # 4) Run RVC
        #    pipeline returns int16 audio at resample_sr (>=16000) if set; we use 16k to simplify chunk alignment.
        f0_method = self._f0_method
        if f0_method == "rmvpe":
            # rmvpe weights must exist; otherwise fallback
            rmvpe_pt = Path(os.environ.get("rmvpe_root", "")) / "rmvpe.pt"
            if not rmvpe_pt.exists():
                f0_method = "harvest"

        # index settings
        file_index = self._index_path
        index_rate = self._index_rate if (file_index and Path(file_index).exists()) else 0.0
        file_index = file_index if index_rate > 0 else ""

        # RVC pipeline call

        # 로그 찍기
        # if not hasattr(self, "_printed_runtime_device"):
        #     self._printed_runtime_device = True
        #     print("[RVC] runtime torch.cuda.is_available() =", torch.cuda.is_available())
        #     print("[RVC] runtime config.device =", getattr(self._config, "device", None))
        #     try:
        #         print("[RVC] runtime net_g device =", next(self._vc.net_g.parameters()).device)
        #     except Exception as e:
        #         print("[RVC] runtime net_g device check failed:", e)
        #     try:
        #         print("[RVC] runtime hubert device =", next(self._vc.hubert_model.parameters()).device)
        #     except Exception as e:
        #         print("[RVC] runtime hubert device check failed:", e)

        #######################


        with torch.no_grad():
            out16_i16 = self._vc.pipeline.pipeline(
                self._vc.hubert_model,
                self._vc.net_g,
                0,  # sid (single speaker model -> 0)
                audio_16k.astype(np.float32, copy=False),
                f"_realtime_{time.time_ns()}",
                [0, 0, 0],
                self._pitch,
                f0_method,
                file_index,
                index_rate,
                self._vc.if_f0,
                0,          # filter_radius
                self._vc.tgt_sr,
                16000,      # resample_sr
                self._rms_mix_rate,
                self._vc.version,
                self._protect,
            )

        # 5) take only the tail corresponding to the newest chunk length (16k domain)
        need = x16.shape[0]
        if out16_i16.shape[0] >= need:
            tail16_i16 = out16_i16[-need:]
        else:
            pad = np.zeros((need - out16_i16.shape[0],), dtype=np.int16)
            tail16_i16 = np.concatenate([pad, out16_i16], axis=0)

        # 6) resample tail back to input sr and match exact byte-size
        tail16 = (tail16_i16.astype(np.float32) / 32768.0)
        y = _resample(tail16, orig_sr=16000, target_sr=sample_rate)

        # enforce sample count == original
        if y.shape[0] > in_samples:
            y = y[:in_samples]
        elif y.shape[0] < in_samples:
            y = np.pad(y, (0, in_samples - y.shape[0]), mode="constant")

        return _float32_to_pcm16le(y)
