from __future__ import annotations

import logging
import os
import sys
import time
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import torch

logger = logging.getLogger(__name__)

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

            vc = VC(config)
            
            # Load generator/discriminator checkpoint and init pipeline/net_g
            sid = self.model_path.name
            vc.get_vc(sid)

            # Load HuBERT
            try:
                vc.hubert_model = load_hubert(config)
            except Exception as e:
                msg = str(e)
                if ("Weights only load failed" in msg) or ("add_safe_globals" in msg) or ("safe_globals" in msg):
                    try:
                        # Allow-list the Dictionary class if fairseq is installed.
                        from fairseq.data.dictionary import Dictionary  # type: ignore

                        if hasattr(torch, "serialization") and hasattr(torch.serialization, "add_safe_globals"):
                            torch.serialization.add_safe_globals([Dictionary])
                    except Exception:
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
            ctx_len_16k = int(self._ctx_16k.shape[0])  # ✅ 추가
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
                sample_rate,      # Request output at TARGET sample rate directly (e.g. 48000)
                self._rms_mix_rate,
                self._vc.version,
                self._protect,
            )
        
        if out16_i16 is None:
             logger.error("RVC pipeline returned None")
             return pcm_bytes # Fallback

        # 5) Extract valid tail (in target sample_rate domain)
        # Input 'x16' is 16k domain. Output 'out16_i16' is in 'sample_rate' domain.
        # Calculate expected output length based on input duration equality
        expected_out_samples = int(round(x16.shape[0] * sample_rate / 16000))
        ctx_len_out = int(round(ctx_len_16k * sample_rate / 16000))
        start = ctx_len_out
        end = start + expected_out_samples

        if out16_i16.shape[0] >= end:
            tail_raw = out16_i16[start:end]
        elif out16_i16.shape[0] > start:
            tail_raw = out16_i16[start:]
            if tail_raw.shape[0] < expected_out_samples:
                tail_raw = np.pad(tail_raw, (0, expected_out_samples - tail_raw.shape[0]), mode="constant")
        else:
            tail_raw = np.zeros((expected_out_samples,), dtype=np.int16)


        # 6) Final Safety Check & Type Conversion
        # Ensure we return valid Int16 bytes
        if tail_raw.dtype == np.int16:
            # Already int16, assumed normalized by pipeline
            pass 
        else:
            # If pipeline returned float (unlikely given typical RVC implementation, but handling for robustness)
            tail_raw = np.clip(tail_raw, -1.0, 1.0)
            tail_raw = (tail_raw * 32767.0).astype(np.int16)
        
        # 7) Output Size Matching
        # Streaming expects 1:1 input/output length to prevent drift.
        # We calculated expected_out_samples, but exact rounding might off-by-one with in_samples.
        if tail_raw.shape[0] > in_samples:
             tail_raw = tail_raw[:in_samples]
        elif tail_raw.shape[0] < in_samples:
             tail_raw = np.pad(tail_raw, (0, in_samples - tail_raw.shape[0]), mode="constant")

        return tail_raw.tobytes()
