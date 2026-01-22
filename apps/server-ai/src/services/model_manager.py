from __future__ import annotations

import os
import asyncio
import yaml
from typing import Dict, Optional
from pathlib import Path
import threading

from src.services.rvc_converter import RVCConverter


class VoiceModelConfig:
    """Voice 모델 설정"""
    def __init__(
        self,
        model_name: str,
        model_path: str,
        voice_model_id: Optional[int] = None,
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
        self._converters: Dict[str, RVCConverter] = {}
        self._configs: Dict[str, VoiceModelConfig] = {}
        self._status: Dict[str, str] = {}  # "READY", "LOADING", "ERROR"
        self._voice_model_id_to_model_name: Dict[int, str] = {}  # voice_model_id -> model_name 매핑
        self._lock = threading.Lock()
    
    def register_model(self, config: VoiceModelConfig) -> None:
        """모델 등록"""
        with self._lock:
            self._configs[config.model_name] = config
            self._status[config.model_name] = "LOADING"
            # voice_model_id가 지정된 경우 매핑 저장
            if config.voice_model_id is not None:
                self._voice_model_id_to_model_name[config.voice_model_id] = config.model_name
    
    async def load_model(self, model_name: str) -> bool:
        """모델 로딩"""
        if model_name not in self._configs:
            print(f"[ERROR] Model not registered: {model_name}")
            return False
        
        config = self._configs[model_name]
        
        try:
            # RVCConverter 생성
            converter = RVCConverter(
                model_path=str(config.model_path),
                device=config.device,
            )
            
            # 모델별 설정을 환경 변수로 설정 (임시)
            # 실제로는 rvc_converter.py를 수정해서 인스턴스 변수로 설정 가능하게 해야 함
            if config.index_path:
                os.environ[f"RVC_INDEX_PATH_{model_name}"] = str(config.index_path)
                os.environ[f"RVC_INDEX_RATE_{model_name}"] = str(config.index_rate)
            os.environ[f"RVC_PITCH_{model_name}"] = str(config.pitch)
            os.environ[f"RVC_PROTECT_{model_name}"] = str(config.protect)
            os.environ[f"RVC_RMS_MIX_RATE_{model_name}"] = str(config.rms_mix_rate)
            
            # 모델 로딩
            await asyncio.to_thread(converter.load_model)
            
            # 모델별 설정 적용 (rvc_converter.py 수정 필요)
            converter._index_path = str(config.index_path) if config.index_path else ""
            converter._index_rate = config.index_rate
            converter._pitch = config.pitch
            converter._protect = config.protect
            converter._rms_mix_rate = config.rms_mix_rate
            
            with self._lock:
                self._converters[model_name] = converter
                self._status[model_name] = "READY"
            
            print(f"[AI Worker] Model loaded: {model_name}")
            return True
            
        except Exception as e:
            with self._lock:
                self._status[model_name] = "ERROR"
            print(f"[ERROR] Failed to load model {model_name}: {e}")
            return False
    
    async def load_all_models(self) -> None:
        """등록된 모든 모델 로딩"""
        model_names = list(self._configs.keys())
        tasks = [self.load_model(model_name) for model_name in model_names]
        await asyncio.gather(*tasks)
    
    def get_converter(self, model_name: str) -> Optional[RVCConverter]:
        """모델 이름으로 변환기 가져오기"""
        with self._lock:
            return self._converters.get(model_name)
    
    def get_status(self, model_name: str) -> str:
        """모델 상태 조회"""
        with self._lock:
            return self._status.get(model_name, "UNKNOWN")
    
    def list_models(self) -> Dict[str, Dict]:
        """등록된 모든 모델 정보 반환"""
        with self._lock:
            return {
                model_name: {
                    "model_name": model_name,
                    "voice_model_id": config.voice_model_id,
                    "status": self._status.get(model_name, "UNKNOWN"),
                }
                for model_name, config in self._configs.items()
            }
    
    def get_model_count(self) -> int:
        """등록된 모델 개수 반환"""
        with self._lock:
            return len(self._configs)
    
    def get_model_name_by_voice_model_id(self, voice_model_id: int) -> Optional[str]:
        """voice_model_id로 model_name 가져오기
        
        Args:
            voice_model_id: voice 모델 ID (int64)
            
        Returns:
            model_name (string) 또는 None (voice_model_id가 등록되지 않은 경우)
        """
        with self._lock:
            return self._voice_model_id_to_model_name.get(voice_model_id)
    
    def get_converter_by_voice_model_id(self, voice_model_id: int) -> Optional[RVCConverter]:
        """voice_model_id로 변환기 가져오기
        
        Args:
            voice_model_id: voice 모델 ID (int64)
            
        Returns:
            RVCConverter 또는 None (voice_model_id가 등록되지 않았거나 모델이 준비되지 않은 경우)
        """
        model_name = self.get_model_name_by_voice_model_id(voice_model_id)
        if model_name:
            return self.get_converter(model_name)
        return None


def load_models_from_config(config_path: str) -> list[VoiceModelConfig]:
    """YAML 설정 파일에서 모델 목록 로드"""
    config_file = Path(config_path)
    if not config_file.exists():
        print(f"[WARNING] Config file not found: {config_path}")
        return []
    
    with open(config_file, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    models = []
    for model_config in config.get('models', []):
        model = VoiceModelConfig(
            model_name=model_config['model_name'],
            model_path=model_config['model_path'],
            voice_model_id=model_config.get('voice_model_id'),
            index_path=model_config.get('index_path'),
            index_rate=model_config.get('index_rate', 0.75),
            pitch=model_config.get('pitch', 0),
            protect=model_config.get('protect', 0.33),
            rms_mix_rate=model_config.get('rms_mix_rate', 1.0),
            device=model_config.get('device', 'cuda'),
        )
        models.append(model)
    
    return models