from __future__ import annotations

import asyncio
import logging
import yaml
from typing import Dict, Optional
from pathlib import Path
import threading

from src.services.rvc_converter import RVCConverter

logger = logging.getLogger(__name__)


class VoiceModelConfig:
    """Voice 모델 설정"""
    def __init__(
        self,
        model_name: str,
        model_path: str,
        voice_model_id: int,
        index_path: Optional[str] = None,
        index_rate: float = 0.75,
        pitch: int = 0,
        protect: float = 0.33,
        rms_mix_rate: float = 1.0,
        device: str = "cuda",
    ):
        self.model_name = model_name
        self.voice_model_id = voice_model_id
        self.model_path = Path(model_path)
        self.index_path = Path(index_path) if index_path else None
        self.index_rate = index_rate
        self.pitch = pitch
        self.protect = protect
        self.rms_mix_rate = rms_mix_rate
        self.device = device


class VoiceModelManager:
    """여러 Voice 모델을 관리하는 매니저"""
    
    def __init__(self):
        self._converters: Dict[int, RVCConverter] = {}  # voice_model_id -> converter
        self._configs: Dict[int, VoiceModelConfig] = {}  # voice_model_id -> config
        self._status: Dict[int, str] = {}  # voice_model_id -> "READY", "LOADING", "ERROR"
        self._lock = threading.Lock()
    
    def register_model(self, config: VoiceModelConfig) -> None:
        """모델 등록"""
        with self._lock:
            self._configs[config.voice_model_id] = config
            self._status[config.voice_model_id] = "LOADING"
    
    async def load_model(self, voice_model_id: int) -> bool:
        """모델 로딩"""
        if voice_model_id not in self._configs:
            logger.error(f"Model not registered: voice_model_id={voice_model_id}")
            return False
        
        config = self._configs[voice_model_id]
        
        try:
            # RVCConverter 생성
            converter = RVCConverter(
                model_path=str(config.model_path),
                device=config.device,
            )
            
            # 모델 로딩
            await asyncio.to_thread(converter.load_model)
            
            # 모델별 설정 적용
            converter._index_path = str(config.index_path) if config.index_path else ""
            converter._index_rate = config.index_rate
            converter._pitch = config.pitch
            converter._protect = config.protect
            converter._rms_mix_rate = config.rms_mix_rate
            
            with self._lock:
                self._converters[voice_model_id] = converter
                self._status[voice_model_id] = "READY"
            
            # 모델 정보 출력
            logger.info(f"Model loaded: {config.model_name} (voice_model_id={voice_model_id})")
            # 타겟 샘플레이트 출력
            if converter._loaded and converter._vc and hasattr(converter._vc, 'tgt_sr'):
                logger.info(f"  Target Sample Rate: {converter._vc.tgt_sr}Hz")
            
            return True
            
        except Exception as e:
            with self._lock:
                self._status[voice_model_id] = "ERROR"
            logger.error(f"Failed to load model {config.model_name} (voice_model_id={voice_model_id}): {e}", exc_info=True)
            return False
    
    async def load_all_models(self) -> None:
        """등록된 모든 모델 로딩"""
        voice_model_ids = list(self._configs.keys())
        tasks = [self.load_model(voice_model_id) for voice_model_id in voice_model_ids]
        await asyncio.gather(*tasks)
    
    def get_converter(self, voice_model_id: int) -> Optional[RVCConverter]:
        """voice_model_id로 변환기 가져오기"""
        with self._lock:
            return self._converters.get(voice_model_id)
    
    def get_status(self, voice_model_id: int) -> str:
        """모델 상태 조회"""
        with self._lock:
            return self._status.get(voice_model_id, "UNKNOWN")  # 외부에서 호출할 수 있으므로 기본값 유지
    
    def list_models(self) -> Dict[int, Dict]:
        """등록된 모든 모델 정보 반환 (voice_model_id를 키로 사용)"""
        with self._lock:
            return {
                voice_model_id: {
                    "model_name": config.model_name,
                    "voice_model_id": voice_model_id,
                    "status": self._status[voice_model_id],  # _configs에 있으면 _status에도 있음
                }
                for voice_model_id, config in self._configs.items()
            }
    
    def get_model_count(self) -> int:
        """등록된 모델 개수 반환"""
        with self._lock:
            return len(self._configs)
    
    def get_converter_by_voice_model_id(self, voice_model_id: int) -> tuple[Optional[RVCConverter], Optional[str]]:
        """voice_model_id로 변환기와 모델 이름 가져오기
        
        Args:
            voice_model_id: voice 모델 ID (int64)
            
        Returns:
            (RVCConverter, model_name) 튜플 또는 (None, None) (voice_model_id가 등록되지 않았거나 모델이 준비되지 않은 경우)
        """
        with self._lock:
            converter = self._converters.get(voice_model_id)
            config = self._configs.get(voice_model_id)
            model_name = config.model_name if config else None
            return converter, model_name


def load_models_from_config(config_path: str) -> list[VoiceModelConfig]:
    """YAML 설정 파일에서 모델 목록 로드"""
    config_file = Path(config_path)
    if not config_file.exists():
        logger.warning(f"Config file not found: {config_path}")
        return []
    
    with open(config_file, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    # 환경변수에서 Root 경로 확인 (기본값: /rvc-code)
    import os
    rvc_root = os.getenv("RVC_WEBUI_ROOT", "/rvc-code")
    
    models = []
    for model_config in config.get('models', []):
        # voice_model_id는 필수값
        if 'voice_model_id' not in model_config:
            logger.error(f"Model '{model_config.get('model_name', 'unknown')}' is missing required 'voice_model_id', skipping")
            continue
            
        # 경로 처리: /rvc-code 로 시작하면 환경변수 값으로 치환
        model_path = model_config['model_path']
        index_path = model_config.get('index_path')
        
        if model_path.startswith("/rvc-code"):
            model_path = model_path.replace("/rvc-code", rvc_root, 1)
            
        if index_path and index_path.startswith("/rvc-code"):
            index_path = index_path.replace("/rvc-code", rvc_root, 1)
        
        model = VoiceModelConfig(
            model_name=model_config['model_name'],
            model_path=model_path,
            voice_model_id=model_config['voice_model_id'],
            index_path=index_path,
            index_rate=model_config.get('index_rate', 0.75),
            pitch=model_config.get('pitch', 0),
            protect=model_config.get('protect', 0.33),
            rms_mix_rate=model_config.get('rms_mix_rate', 1.0),
            device=model_config.get('device', 'cuda'),
        )
        models.append(model)
    
    return models