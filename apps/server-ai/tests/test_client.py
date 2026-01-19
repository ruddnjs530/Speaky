import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
import grpc
from shared_proto import voice_pb2, voice_pb2_grpc


async def main():
    async with grpc.aio.insecure_channel("localhost:50051") as channel:
        stub = voice_pb2_grpc.VoiceServiceStub(channel)

        status = await stub.GetStatus(voice_pb2.StatusRequest())
        print("STATUS:", status.status)

        async def gen():
            for i in range(3):
                yield voice_pb2.AudioChunk(pcm=f"chunk-{i}".encode(), sample_rate=16000, channels=1)

        async for out in stub.ConvertStream(gen()):
            print("OUT:", out.pcm.decode(), out.sample_rate, out.channels)


if __name__ == "__main__":
    asyncio.run(main())
