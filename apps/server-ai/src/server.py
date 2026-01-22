from __future__ import annotations

import asyncio
import os
import signal
from typing import AsyncIterator, Optional

import grpc

# proto에서 생성된 코드 import
from shared_proto import voice_pb2, voice_pb2_grpc

# RVC 모델 관리자 import
from src.services.model_manager import VoiceModelManager, load_models_from_config


class VoiceService(voice_pb2_grpc.VoiceServiceServicer):
    def __init__(self, model_manager: VoiceModelManager):
        self.model_manager = model_manager
    
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

    async def ConvertStream(
        self,
        request_iterator: AsyncIterator[voice_pb2.AudioChunk],
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[voice_pb2.AudioChunk]:
        """
        오디오 스트림 변환
        - AudioChunk의 voice_model_id를 받아서 해당 모델 사용
        - voice_model_id가 없으면 첫 번째 READY 모델 사용
        - 모델이 없으면 pass-through
        """
        current_model_name: Optional[str] = None
        converter = None
        
        async for chunk in request_iterator:
            # voice_model_id 추출 (int64) 및 model_name(string)로 변환
            voice_model_id = chunk.voice_model_id if chunk.voice_model_id else None
            model_name = None
            
            if voice_model_id is not None:
                # voice_model_id로 model_name 가져오기
                model_name = self.model_manager.get_model_name_by_voice_model_id(voice_model_id)
            
            # model_name이 없으면 첫 번째 READY 모델 사용
            if not model_name:
                models = self.model_manager.list_models()
                ready_models = [m for m in models.values() if m["status"] == "READY"]
                if ready_models:
                    model_name = ready_models[0]["model_name"]
            
            # 모델이 변경되었거나 처음인 경우
            if model_name and model_name != current_model_name:
                converter = self.model_manager.get_converter(model_name)
                if converter:
                    current_model_name = model_name
                    print(f"[AI Worker] Using model: {model_name}")
                else:
                    print(f"[WARNING] Model not found or not ready: {model_name}, using pass-through")
                    converter = None
                    current_model_name = None
            
            # 모델이 없으면 pass-through
            if converter is None:
                yield voice_pb2.AudioChunk(
                    pcm=chunk.pcm,
                    sample_rate=chunk.sample_rate,
                    channels=chunk.channels,
                )
                continue
            
            # RVC 변환 수행
            try:
                out_pcm = await asyncio.to_thread(
                    converter.convert,
                    chunk.pcm,
                    int(chunk.sample_rate),
                    int(chunk.channels),
                )
            except Exception as e:
                print(f"[ERROR] Conversion failed: {e}")
                # 변환 실패 시 pass-through
                out_pcm = chunk.pcm
            
            yield voice_pb2.AudioChunk(
                pcm=out_pcm,
                sample_rate=chunk.sample_rate,
                channels=chunk.channels,
            )


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
        print(f"[AI Worker] Loading {len(configs)} models...")
        await model_manager.load_all_models()
        loaded_models = list(model_manager.list_models().keys())
        print(f"[AI Worker] Loaded models: {loaded_models}")
    else:
        print("[AI Worker] No models configured, running in pass-through mode")
    
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
    print(f"[AI Worker] gRPC server started at {listen_addr} (RVC={rvc_status})")

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
    print("[AI Worker] shutting down...")
    await server.stop(grace=3)


if __name__ == "__main__":
    asyncio.run(serve())
