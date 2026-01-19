# ==========================================
# Common Base Stage
# ==========================================
FROM golang:1.25-alpine AS base

# Install system dependencies
RUN apk add --no-cache git make gcc musl-dev pkgconfig opus-dev opusfile-dev soxr-dev

WORKDIR /app

# 1. Copy Shared Packages (Proto) - Less frequent changes
COPY packages/proto /packages/proto

# 2. Copy Go Modules - Dependent on go.mod/sum changes
COPY apps/server-media/go.mod apps/server-media/go.sum ./
RUN go mod download

# ==========================================
# Development Stage (Hot Reload)
# ==========================================
FROM base AS dev

# Install Air for hot reload
RUN go install github.com/air-verse/air@latest
RUN go install github.com/go-delve/delve/cmd/dlv@latest

# Copy source code (Bind mount recommended instead for dev)
COPY apps/server-media .

# Air command (will be overridden by command in compose but good default)
CMD ["air", "-c", ".air.toml"]

# ==========================================
# Builder Stage (Production Build)
# ==========================================
FROM base AS builder

# Copy source code
COPY apps/server-media .

# Build
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o bin/server ./cmd/server/main.go

# ==========================================
# Production Stage
# ==========================================
FROM alpine:latest AS prod

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/bin/server .

# Expose ports
# HTTP
EXPOSE 8080 
# gRPC
EXPOSE 50051
# RTC UDP
EXPOSE 50000-50010/udp

# Run
CMD ["./server"]
