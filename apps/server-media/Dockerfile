FROM golang:1.25-alpine AS base
RUN apk add --no-cache git make gcc musl-dev pkgconfig opus-dev opusfile-dev soxr-dev

WORKDIR /app
# Why: Cache Go modules layer first
COPY apps/server-media/go.mod apps/server-media/go.sum ./
COPY packages/proto/generated/go /packages/proto/generated/go
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
