from __future__ import annotations

import asyncio
import logging
import os
import signal
import traceback
from typing import AsyncIterator, Optional

import grpc

# proto에서 생성된 코드 import
from shared_proto import voice_pb2, voice_pb2_grpc

# RVC 모델 관리자 import
from src.services.model_manager import VoiceModelManager, load_models_from_config
from src.services.rvc_converter import RVCConverter

# 로깅 설정
logger = logging.getLogger(__name__)


class VoiceService(voice_pb2_grpc.VoiceServiceServicer):
    def __init__(self, model_manager: VoiceModelManager):
        self.model_manager = model_manager
        self._logged_error_types = set()  # 에러 타입별로 traceback 출력 추적
        self._first_sample_rate_warning_logged = False  # 샘플레이트 경고 한 번만 출력
    
    async def GetStatus(self, request: voice_pb2.StatusRequest, context: grpc.aio.ServicerContext):
        """서버 전체 상태 반환
        
        - 하나라도 READY 모델이 있으면 READY 반환
        - 모든 모델이 ERROR면 ERROR 반환
        - 그 외는 LOADING 반환
        """
        models = self.model_manager.list_models()
        if not models:
            return voice_pb2.StatusResponse(status="ERROR")
        
        # 하나라도 READY 모델이 있으면 READY
        has_ready = any(m["status"] == "READY" for m in models.values())
        if has_ready:
            return voice_pb2.StatusResponse(status="READY")
        
        # 모든 모델이 ERROR면 ERROR
        all_error = all(m["status"] == "ERROR" for m in models.values())
        if all_error:
            return voice_pb2.StatusResponse(status="ERROR")
        
        # 그 외는 LOADING
        return voice_pb2.StatusResponse(status="LOADING")
    
    async def ListModels(self, request: voice_pb2.ListModelsRequest, context: grpc.aio.ServicerContext):
        """로딩 성공한 모델 목록만 반환 (READY 상태만)
        
        Returns:
            ListModelsResponse: READY 상태인 모델들의 목록
        """
        all_models = self.model_manager.list_models()
        
        # READY 상태인 모델만 필터링
        ready_models = [
            model_data
            for model_data in all_models.values()
            if model_data["status"] == "READY"
        ]
        
        # VoiceModel 메시지로 변환
        voice_models = []
        for model_data in ready_models:
            voice_model_id = model_data.get("voice_model_id")
            # voice_model_id가 None이면 제외
            if voice_model_id is None:
                continue
            
            voice_models.append(
                voice_pb2.VoiceModel(
                    model_name=model_data["model_name"],
                    voice_model_id=voice_model_id,
                )
            )
        
        return voice_pb2.ListModelsResponse(models=voice_models)

    async def ConvertStream(
        self,
        request_iterator: AsyncIterator[voice_pb2.AudioChunk],
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[voice_pb2.AudioChunk]:
        """
        오디오 스트림 변환
        - 첫 번째 청크의 voice_model_id로 모델 선택 (연결당 한 번만)
        - 이후 청크들은 같은 모델 재사용 (voice_model_id는 변경되지 않음)
        - voice_model_id가 없으면 pass-through
        - 모델이 없으면 pass-through
        """
        current_converter: Optional[RVCConverter] = None
        model_initialized = False  # 첫 번째 청크에서만 모델 선택
        
        async for chunk in request_iterator:
            # 첫 번째 청크에서만 모델 선택 (연결당 한 번만)
            if not model_initialized:
                voice_model_id = chunk.voice_model_id if chunk.voice_model_id else None
                
                if voice_model_id is not None:
                    converter, model_name = self.model_manager.get_converter_by_voice_model_id(voice_model_id)
                else:
                    converter, model_name = None, None
                
                # 모델 선택 완료
                current_converter = converter
                model_initialized = True
                
                if model_name:
                    logger.info(f"Using model: {model_name}")
                elif converter is None:
                    logger.info("No model available, using pass-through")
            
            # 이후 청크들은 첫 번째에서 선택한 모델 재사용
            converter = current_converter
            
            # 모델이 없으면 pass-through
            if converter is None:
                yield voice_pb2.AudioChunk(
                    pcm=chunk.pcm,
                    sample_rate=chunk.sample_rate,
                    channels=chunk.channels,
                    timestamp=chunk.timestamp,
                )
                continue
            
            # RVC 변환 수행
            try:
                # 샘플레이트 검증 (RVC는 16kHz 또는 24kHz 권장)
                sample_rate = int(chunk.sample_rate)
                if sample_rate not in [16000, 24000]:
                    # 첫 번째 경고만 출력 (로그 과다 방지)
                    if not self._first_sample_rate_warning_logged:
                        logger.warning(f"Sample rate {sample_rate}Hz may not work optimally. RVC expects 16kHz or 24kHz.")
                        self._first_sample_rate_warning_logged = True
                
                out_pcm = await asyncio.to_thread(
                    converter.convert,
                    chunk.pcm,
                    sample_rate,
                    int(chunk.channels),
                )
                
                # 변환 성공 확인 (원본과 동일하면 변환이 안 된 것일 수 있음)
                # 단, 매우 짧은 청크나 무음은 원본과 같을 수 있으므로 경고만 출력
                if len(chunk.pcm) > 1000 and out_pcm == chunk.pcm:
                    logger.warning("Output is identical to input - conversion may have failed or returned original")
                    
            except Exception as e:
                # 에러 정보 수집
                error_type = type(e).__name__
                error_msg = str(e) if e else ""
                
                # 에러 타입별로 첫 번째 발생 시에만 traceback 출력 (로그 과다 방지)
                if error_type not in self._logged_error_types:
                    if error_msg and len(error_msg.strip()) > 0:
                        logger.error(f"Conversion failed: {error_type}: {error_msg}", exc_info=True)
                    else:
                        logger.error(f"Conversion failed: {error_type} (no message)", exc_info=True)
                    self._logged_error_types.add(error_type)
                else:
                    # 이미 로그된 에러 타입은 메시지만 출력
                    if error_msg and len(error_msg.strip()) > 0:
                        logger.error(f"Conversion failed: {error_type}: {error_msg}")
                    else:
                        logger.error(f"Conversion failed: {error_type} (no message)")
                
                # 변환 실패 시 pass-through
                out_pcm = chunk.pcm
            
            yield voice_pb2.AudioChunk(
                pcm=out_pcm,
                sample_rate=chunk.sample_rate,
                channels=chunk.channels,
                timestamp=chunk.timestamp,
            )


def _setup_logging() -> None:
    """로깅 시스템 설정"""
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    log_format = os.getenv(
        "LOG_FORMAT",
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )
    
    # 로그 레벨 설정
    numeric_level = getattr(logging, log_level, logging.INFO)
    
    # 루트 로거 설정
    logging.basicConfig(
        level=numeric_level,
        format=log_format,
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    
    # 외부 라이브러리 로그 레벨 조정 (너무 많은 로그 방지)
    logging.getLogger("grpc").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)


async def serve(host: str = "0.0.0.0", port: int = 50051) -> None:
    # 모델 매니저 초기화
    model_manager = VoiceModelManager()
    
    # 모델 설정 로드
    config_path = os.getenv("MODELS_CONFIG_PATH", "src/config/models.yaml")
    configs = load_models_from_config(config_path)
    
    # 모델 등록
    for config in configs:
        model_manager.register_model(config)
    
    # 모든 모델 로딩
    if configs:
        logger.info(f"Loading {len(configs)} models...")
        await model_manager.load_all_models()
        models = model_manager.list_models()
        ready_models = [m["model_name"] for m in models.values() if m["status"] == "READY"]
        error_models = [m["model_name"] for m in models.values() if m["status"] == "ERROR"]
        
        if ready_models:
            logger.info(f"Ready models ({len(ready_models)}): {ready_models}")
        if error_models:
            logger.error(f"Failed models ({len(error_models)}): {error_models}")
    else:
        logger.info("No models configured, running in pass-through mode")
    
    # gRPC 서버 설정
    server = grpc.aio.server(
        options=[
            # 메시지 크기 제한(기본이 작아서 스트리밍 오디오에서 종종 걸림) - 필요 시 조정
            ("grpc.max_receive_message_length", 64 * 1024 * 1024),
            ("grpc.max_send_message_length", 64 * 1024 * 1024),
        ]
    )
    
    voice_pb2_grpc.add_VoiceServiceServicer_to_server(
        VoiceService(model_manager), server
    )
    
    listen_addr = f"{host}:{port}"
    server.add_insecure_port(listen_addr)

    await server.start()
    rvc_status = "ON" if configs else "OFF"
    logger.info(f"gRPC server started at {listen_addr} (RVC={rvc_status})")

    # Ctrl+C graceful shutdown
    stop_event = asyncio.Event()

    def _handle_stop(*_):
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _handle_stop)
        except NotImplementedError:
            # Windows에서 일부 시그널은 미지원일 수 있음
            pass

    await stop_event.wait()
    logger.info("Shutting down...")
    await server.stop(grace=3)


if __name__ == "__main__":
    _setup_logging()
    asyncio.run(serve())
