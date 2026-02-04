# Speaky Docker Deployment Guide (Safe Version)

This guide provides a bulletproof strategy for deploying the Speaky system. It separates **Stable Demo** (built artifacts) from **Development** (hot-reload) environments to ensure reliability.

## 📁 System Architecture

| Environment | Command | Feature |
| :--- | :--- | :--- |
| **Demo (Stable)** | `make demo` | Production builds (Nginx, JAR, Binaries), Isolated, Reliable. |
| **Dev (Hot)** | `make dev` | Source mounts, Hot Reload (Vite, Air, Watchdog, BootRun). |

---

## 🛠️ Prerequisites

1.  **Docker & Docker Compose**: Ensure Docker Engine is running.
2.  **Make**: (Optional) For easier command execution.
3.  **Environment Variables**:
    ```bash
    cp .env.example .env
    # EDIT .env immediately to set RVC paths!
    ```

---

## 🚀 1. Stable Demo Deployment

Use this for the final presentation. It minimizes "it works on my machine" issues by using compiled artifacts.

### Step 1: Generate Protocols
We use a consistent, containerized builder to generate Go and Python code from `.proto` files.

```bash
make proto
# OR manually:
# docker build -t speaky-proto-builder -f packages/proto/Dockerfile.builder .
# docker run --rm -v $(pwd):/workspace speaky-proto-builder ./scripts/generate_proto.sh
```

### Step 2: Build & Run
```bash
make demo
# OR manually:
# docker-compose up -d --build
```
*Note: The first build of `server-ai` may take ~10-15 minutes.*

### Step 3: Verification
```bash
make verify
# OR manually:
# ./scripts/verify_demo.sh
```

---

## 💻 2. Development Environment

Use this for coding. Changes in `apps/` are reflected immediately.

```bash
make dev
# OR manually:
# docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

**Key Features:**
-   **Client**: Vite HMR (Hot Module Replacement) enabled.
-   **Media Server**: `air` automatically recompiles Go code on save.
-   **AI Server**: `watchdog` restarts Python process on file change.
-   **SC Server**: `gradle bootRun` launches from source.

---

## 🏗️ internal Configuration Details

### Proto & Go Modules
To ensure `go.mod` works inside Docker without changing code, we use a volume mirror:
-   **Host Path**: `./packages/proto/generated/go`
-   **Container Path**: `/packages/proto/generated/go`
-   **Reason**: `go.mod` defines `replace mediaserver/proto => ../../packages/proto/generated/go`. Keeping the relative path identical allows the compiler to resolve it.

### AI Server Health Check
-   **Mechanism**: TCP Connect to port 50051.
-   **Timeout**: 3.5 minutes (20 retries * 10s interval).
-   **Why**: Loading RVC models (PyTorch) onto GPU is heavy and slow.

### Server-SC Volume (Dev Only)
-   **Demo**: Dockerfile builds a JAR. No volume. Safe from overwrites.
-   **Dev**: Mounts source code. Runs via Gradle.

---

## ❓ Troubleshooting

**Q: "go.mod: replacement module not found"**
A: Run `make proto` first. The generated files must exist on the host before Docker starts.

**Q: AI Server stays "Unhealthy"**
A: Check logs (`docker-compose logs -f server-ai`). If you see "CUDA not available", ensure you installed **NVIDIA Container Toolkit** or switch code to CPU mode.

**Q: Client cannot connect to Signaling Server**
A: Ensure `server-sc` is running. Check `http://localhost:8080/h2-console`.
