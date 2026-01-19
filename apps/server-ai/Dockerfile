# ==========================================
# Base Stage
# ==========================================
FROM python:3.10-slim AS base

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 1. Copy Shared Packages (Proto)
COPY packages/proto /packages/proto

# 2. Copy Requirements
COPY apps/server-ai/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app:/packages/proto/generated/python

# ==========================================
# Development Stage
# ==========================================
FROM base AS dev
# Install dev tools if needed (e.g., watchdog for hot reload)
RUN pip install watchdog

# Copy source code (optional, typically bind mounted in compose)
COPY apps/server-ai .

CMD ["python", "-m", "src.server"]

# ==========================================
# Production Stage
# ==========================================
FROM base AS prod

# Copy Source Code
COPY apps/server-ai .

# Expose port
EXPOSE 50051

# Run
CMD ["python", "-m", "src.server"]
