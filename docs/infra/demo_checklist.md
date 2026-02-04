# Speaky Demo Deployment Checklist (Safe Version)

This checklist is used alongside the [Docker Deployment Guide](file:///home/yooshnn/projects/speaky/docs/infra/docker_deployment.md).

## 🟢 Phase 1: Environment Preparation
- [ ] **Step 1.1**: Initialize Environment File
    - Run `cp .env.example .env` in the project root.
- [ ] **Step 1.2**: Configure RVC Model Paths
    - Open `.env` and verify `RVC_ASSETS_PATH`, `RVC_CODE_INFER_PATH` point to valid directories.
- [ ] **Step 1.3**: Host Prep
    - Check Docker: `docker info`
    - Check GPU (Optional): `nvidia-smi`

## 🛠️ Phase 2: Proto Generation
- [ ] **Step 2.1**: Generate Protocols
    - Run: `make proto`
    - Or if no Make: `./scripts/generate_proto.sh` (requires builder setup)
- [ ] **Step 2.2**: Verify Generated Files
    - [ ] `ls packages/proto/generated/go` (Should contain .pb.go files)
    - [ ] `ls packages/proto/generated/python` (Should contain _pb2.py files)

## 🏗️ Phase 3: Build & Launch (Stable Demo)
- [ ] **Step 3.1**: Launch Demo
    - Run: `make demo`
    - (Or `docker-compose up -d --build`)
- [ ] **Step 3.2**: Wait for Initialization
    - Watch logs: `docker-compose logs -f server-ai`
    - Wait for: `"gRPC server started at [::]:50051"`

## ✅ Phase 4: Verification
- [ ] **Step 4.1**: Automated Check
    - Run: `make verify`
    - Ensure all services are marked ✅
- [ ] **Step 4.2**: Web Client
    - Open [http://localhost:5173](http://localhost:5173) (Served by Nginx)
- [ ] **Step 4.3**: End-to-End Test
    - Join a room.
    - Check Media Server logs: `docker-compose logs -f server-media`
    - Confirm "Connecting to AI Server" and audio packet flow.

## 🔄 Rebuild Triggers
- **Proto Change**: Run `make proto` then `make demo`.
- **Code Change**:
    - **Demo**: Run `make demo` (Rebuilds artifacts).
    - **Dev**: Run `make dev` (Hot Reloads instantly).
