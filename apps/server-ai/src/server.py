from __future__ import annotations

import asyncio
import signal
from typing import AsyncIterator

import grpc

# proto에서 생성된 코드 import
from shared_proto import voice_pb2, voice_pb2_grpc


class VoiceService(voice_pb2_grpc.VoiceServiceServicer):
    async def GetStatus(self, request: voice_pb2.StatusRequest, context: grpc.aio.ServicerContext):
        # MVP: 모델 로딩 전이므로 항상 READY로 응답 (나중에 LOADING/ERROR로 확장)
        return voice_pb2.StatusResponse(status="READY")

    async def ConvertStream(
        self,
        request_iterator: AsyncIterator[voice_pb2.AudioChunk],
        context: grpc.aio.ServicerContext,
    ) -> AsyncIterator[voice_pb2.AudioChunk]:
        """
        MVP: pass-through (에코)
        - Media Server가 보낸 PCM chunk를 그대로 반환
        - 나중에 여기서 RVC 변환(PCM -> PCM)을 수행
        """
        async for chunk in request_iterator:
            # 그대로 반환 (sample_rate/channels도 유지)
            yield voice_pb2.AudioChunk(
                pcm=chunk.pcm,
                sample_rate=chunk.sample_rate,
                channels=chunk.channels,
            )


async def serve(host: str = "0.0.0.0", port: int = 50051) -> None:
    server = grpc.aio.server(
        options=[
            # 메시지 크기 제한(기본이 작아서 스트리밍 오디오에서 종종 걸림) - 필요 시 조정
            ("grpc.max_receive_message_length", 16 * 1024 * 1024),
            ("grpc.max_send_message_length", 16 * 1024 * 1024),
        ]
    )
    voice_pb2_grpc.add_VoiceServiceServicer_to_server(VoiceService(), server)
    listen_addr = f"{host}:{port}"
    server.add_insecure_port(listen_addr)

    await server.start()
    print(f"[AI Worker] gRPC server started at {listen_addr}")

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
