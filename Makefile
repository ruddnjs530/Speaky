.PHONY: proto build demo dev stop clean verify help

# --- Variables ---
DOCKER_COMPOSE_STABLE = docker-compose.yml
DOCKER_COMPOSE_DEV = docker-compose.dev.yml

# --- High Level Commands ---

help:
	@echo "Speaky Project - Orchestration Tool"
	@echo ""
	@echo "Usage:"
	@echo "  make proto      - Generate synchronized Go/Python proto files"
	@echo "  make demo       - Launch stable demo environment (Uses JARs/Binaries)"
	@echo "  make dev        - Launch development environment (Hot Reload/Volumes)"
	@echo "  make stop       - Stop all containers"
	@echo "  make verify     - Run the service availability check script"
	@echo "  make clean      - Remove generated files and docker artifacts"

# 1. Generate Protos using the internal builder
proto:
	@echo "🏗️ Building Proto Builder..."
	docker build -t speaky-proto-builder -f packages/proto/Dockerfile.builder .
	@echo "🧬 Generating Proto Files..."
	MSYS_NO_PATHCONV=1 docker run --rm -v $$(pwd):/workspace speaky-proto-builder ./scripts/generate_proto.sh

# 2. Launch Stable Demo
demo:
	@echo "🚀 Launching STABLE DEMO..."
	docker-compose -f $(DOCKER_COMPOSE_STABLE) up -d --build

# 3. Launch Development Environment
dev:
	@echo "🛠️ Launching DEV ENVIRONMENT (Hot Reload)..."
	docker-compose -f $(DOCKER_COMPOSE_STABLE) -f $(DOCKER_COMPOSE_DEV) up -d --build

# 4. Stop and Clean
stop:
	docker-compose down

clean: stop
	rm -rf packages/proto/generated/*
	docker rmi speaky-proto-builder || true

# 5. Verify Status
verify:
	./scripts/verify_demo.sh