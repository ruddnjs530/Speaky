# ==============================================================================
# Docker-based Development Makefile
# ==============================================================================
.PHONY: help proto proto-check proto-clean
.PHONY: up down restart logs ps
.PHONY: build build-no-cache
.PHONY: dev-media dev-ai dev-client
.PHONY: shell-media shell-ai shell-client
.PHONY: clean

# Colors
COLOR_RESET   := \033[0m
COLOR_BLUE    := \033[34m
COLOR_GREEN   := \033[32m
COLOR_YELLOW  := \033[33m
COLOR_RED     := \033[31m

# Directories
PROTO_DIR := packages/proto

# ============================================
# Help
# ============================================
help:
	@echo "$(COLOR_BLUE)📦 Media Streaming Platform - Monorepo (Docker Edition)$(COLOR_RESET)"
	@echo ""
	@echo "$(COLOR_GREEN)🚀 Main Commands:$(COLOR_RESET)"
	@echo "  make up              - Start all services (detached)"
	@echo "  make down            - Stop and remove containers"
	@echo "  make restart         - Restart all services"
	@echo "  make logs            - Follow logs for all services"
	@echo "  make ps              - Show running containers"
	@echo ""
	@echo "$(COLOR_GREEN)🔨 Build Commands:$(COLOR_RESET)"
	@echo "  make build           - Build all images"
	@echo "  make build-no-cache  - Build all images without cache"
	@echo ""
	@echo "$(COLOR_GREEN)🔭 Service Specific:$(COLOR_RESET)"
	@echo "  make logs-media      - Logs for Media Server"
	@echo "  make logs-ai         - Logs for AI Server"
	@echo "  make logs-client     - Logs for Client"
	@echo "  make shell-media     - Shell into Media Server"
	@echo "  make shell-ai        - Shell into AI Server"
	@echo ""
	@echo "$(COLOR_GREEN)⚡ Proto Commands:$(COLOR_RESET)"
	@echo "  make proto           - Generate protobuf for Go + Python"
	@echo "  make proto-clean     - Clean generated proto files"

# ============================================
# Docker Commands
# ============================================
up: proto
	@echo "$(COLOR_BLUE)🐳 Starting services...$(COLOR_RESET)"
	docker-compose up -d
	@echo "$(COLOR_GREEN)✅ Services started. Run 'make logs' to view output.$(COLOR_RESET)"

down:
	@echo "$(COLOR_BLUE)🛑 Stopping services...$(COLOR_RESET)"
	docker-compose down
	@echo "$(COLOR_GREEN)✅ Services stopped.$(COLOR_RESET)"

restart: down up

# --- Service Specific Commands ---

# Client (Frontend)
up-client: proto
	@echo "$(COLOR_BLUE)🚀 Starting Client only...$(COLOR_RESET)"
	docker-compose up -d client
	@echo "$(COLOR_GREEN)✅ Client started: http://localhost:5173$(COLOR_RESET)"

down-client:
	@echo "$(COLOR_BLUE)🛑 Stopping Client...$(COLOR_RESET)"
	docker-compose stop client
	docker-compose rm -f client

restart-client: down-client up-client

# Media Server (Backend)
up-media: proto
	@echo "$(COLOR_BLUE)🎥 Starting Media Server...$(COLOR_RESET)"
	docker-compose up -d server-media
	@echo "$(COLOR_GREEN)✅ Media Server started (with dependencies)$(COLOR_RESET)"

down-media:
	@echo "$(COLOR_BLUE)🛑 Stopping Media Server...$(COLOR_RESET)"
	docker-compose stop server-media
	docker-compose rm -f server-media

restart-media: down-media up-media

# AI Server
up-ai: proto
	@echo "$(COLOR_BLUE)🤖 Starting AI Server...$(COLOR_RESET)"
	docker-compose up -d server-ai
	@echo "$(COLOR_GREEN)✅ AI Server started$(COLOR_RESET)"

down-ai:
	@echo "$(COLOR_BLUE)🛑 Stopping AI Server...$(COLOR_RESET)"
	docker-compose stop server-ai
	docker-compose rm -f server-ai

restart-ai: down-ai up-ai

# Signaling Server (SC)
up-sc: proto
	@echo "$(COLOR_BLUE)📡 Starting Signaling Server...$(COLOR_RESET)"
	docker-compose up -d server-sc

down-sc:
	@echo "$(COLOR_BLUE)🛑 Stopping Signaling Server...$(COLOR_RESET)"
	docker-compose stop server-sc
	docker-compose rm -f server-sc

restart-sc: down-sc up-sc

logs:
	docker-compose logs -f

ps:
	docker-compose ps

build: proto
	@echo "$(COLOR_BLUE)🔨 Building images...$(COLOR_RESET)"
	docker-compose build

build-no-cache: proto
	@echo "$(COLOR_BLUE)🔨 Building images (no cache)...$(COLOR_RESET)"
	docker-compose build --no-cache

# ============================================
# Service Specific Shortcuts
# ============================================
logs-media:
	docker-compose logs -f server-media

logs-ai:
	docker-compose logs -f server-ai

logs-client:
	docker-compose logs -f client

shell-media:
	docker-compose exec server-media /bin/sh

shell-ai:
	docker-compose exec server-ai /bin/bash

# ============================================
# Proto Commands (Dockerized)
# ============================================
proto-image:
	@echo "$(COLOR_BLUE)🐳 Building Proto Builder Image...$(COLOR_RESET)"
	docker build -t monorepo-proto-builder -f packages/proto/Dockerfile.builder .

proto: proto-image
	@echo "$(COLOR_BLUE)🔨 Generating protobuf (via Docker)...$(COLOR_RESET)"
	docker run --rm \
		-v "$(PWD):/workspace" \
		-u "$(shell id -u):$(shell id -g)" \
		-e HOME=//tmp \
		-e GOPATH=//tmp/go \
		-e GOCACHE=//tmp/gocache \
		monorepo-proto-builder \
		./scripts/gen-proto.sh
	@echo "$(COLOR_GREEN)✅ Proto files generated$(COLOR_RESET)"

proto-check:
	@echo "$(COLOR_BLUE)🔍 Checking proto tools...$(COLOR_RESET)"
	@echo "Proto generation runs in Docker. No local tools needed. $(COLOR_GREEN)✓$(COLOR_RESET)"

proto-clean:
	@echo "$(COLOR_BLUE)🧹 Cleaning generated proto files...$(COLOR_RESET)"
	rm -rf $(PROTO_DIR)/generated/go/*.go
	rm -rf $(PROTO_DIR)/generated/python/*.py

# ============================================
# Clean
# ============================================
clean: down proto-clean
	@echo "$(COLOR_BLUE)🧹 Cleaning up...$(COLOR_RESET)"
	@echo "$(COLOR_GREEN)✅ Clean complete$(COLOR_RESET)"