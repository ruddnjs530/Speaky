FROM golang:1.25-alpine

# Install System Dependencies (Python, Protoc, Make)
RUN apk add --no-cache \
    python3 \
    py3-pip \
    protoc \
    protobuf-dev \
    make \
    bash

# Install Python Tools (grpcio-tools)
# --break-system-packages is needed for Alpine 3.19+ (python 3.11+) if we don't use venv
RUN pip3 install --no-cache-dir grpcio-tools --break-system-packages

# Install Go Tools (protoc-gen-go, protoc-gen-go-grpc)
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest && \
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

WORKDIR /workspace
