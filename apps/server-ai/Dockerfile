FROM python:3.10.13-slim-bookworm AS base
WORKDIR /app

# System dependencies (cached)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ make ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 1. Install Python Dependencies (Cached unless requirements.txt changes)
COPY apps/server-ai/requirements.txt .
COPY packages/proto /packages/proto
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt

# 2. Add GPU Check Script
RUN echo 'import torch; print(f"GPU Available: {torch.cuda.is_available()}")' > check_gpu.py

ENV PYTHONUNBUFFERED=1
# Proto path will be mounted at /packages/proto via Volume
ENV PYTHONPATH=/app:/packages/proto/generated/python
ENV PORT=50051

FROM base AS dev
RUN pip install watchdog
# Why: Fix port to match architecture
CMD ["python", "-m", "src.server", "--port", "50051"]

FROM base AS prod
COPY apps/server-ai .
EXPOSE 50051
CMD ["python", "-m", "src.server", "--port", "50051"]
