FROM golang:1.25-alpine AS base
RUN apk add --no-cache git make gcc musl-dev pkgconfig opus-dev opusfile-dev soxr-dev

WORKDIR /app
# Why: Cache Go modules layer first
COPY apps/server-media/go.mod apps/server-media/go.sum ./
# Install protoc and plugins for generation
RUN apk add --no-cache protobuf-dev
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
RUN go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

WORKDIR /app
# Why: Cache Go modules layer first
COPY apps/server-media/go.mod apps/server-media/go.sum ./

# Copy raw proto definitions and generate Go code
COPY packages/proto /packages/proto
RUN mkdir -p /packages/proto/generated/go
RUN protoc --proto_path=/packages/proto \
    --go_out=/packages/proto/generated/go --go_opt=paths=source_relative \
    --go-grpc_out=/packages/proto/generated/go --go-grpc_opt=paths=source_relative \
    /packages/proto/*.proto

# Create go.mod for generated proto if missing (required for invalid replace directive resolution)
RUN if [ ! -f "/packages/proto/generated/go/go.mod" ]; then \
    echo "module mediaserver/proto" > /packages/proto/generated/go/go.mod && \
    echo "go 1.25.5" >> /packages/proto/generated/go/go.mod; \
    fi

RUN go mod download

FROM base AS dev
RUN go install github.com/air-verse/air@latest
WORKDIR /app
# NOTE: Proto files will be mounted at /app/proto by docker-compose
CMD ["air", "-c", ".air.toml"]

FROM base AS builder
COPY apps/server-media .
RUN go mod tidy
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o bin/server ./cmd/server/main.go

FROM alpine:3.21 AS prod
# Why: Install runtime libraries needed by CGO binary
RUN apk add --no-cache opus opusfile soxr
WORKDIR /root/
COPY --from=builder /app/bin/server .
EXPOSE 8090 50051 50000-50010/udp
CMD ["./server"]
