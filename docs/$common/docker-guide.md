# 🐳 Docker & Makefile 개발 가이드

이 문서는 우리 프로젝트의 개발 환경을 설정하고 사용하는 방법을 설명합니다.  
우리는 **Docker**를 통해 모든 팀원이 동일한 환경에서 개발할 수 있도록 하고, **Makefile**을 통해 복잡한 명령어들을 쉽게 실행합니다.

---

## 1. 시작하기 전에 (Prerequisites)

이 프로젝트를 실행하려면 컴퓨터에 다음이 설치되어 있어야 합니다:

- **Docker Desktop** (또는 Docker Engine & Docker Compose)
- **Make** (Windows 사용자는 `Chocolatey` 등으로 설치하거나 Git Bash 사용 권장)

---

## 2. 가장 자주 쓰는 명령어 3가지 🚀

터미널(Root 경로)에서 딱 3개만 기억하면 됩니다!

### 1️⃣ 서버 켜기 (Start)
```bash
make up
```
> **이 명령어가 하는 일:**
> - 필요한 Docker 이미지들을 빌드합니다.
> - 백그라운드에서 모든 서버(React, Go, Python 등)를 실행합니다.
> - **주의:** 처음 실행할 때는 이미지를 다운로드하느라 시간이 좀 걸릴 수 있어요!

### 2️⃣ 로그 보기 (Logs)
```bash
make logs
```
> **이 명령어가 하는 일:**
> - 실행 중인 모든 서버의 로그를 실시간으로 보여줍니다.
> - 에러가 났는지 확인할 때 필수입니다.
> - 나가려면 `Ctrl + C`를 누르세요.

### 3️⃣ 서버 끄기 (Stop)
```bash
make down
```
> **이 명령어가 하는 일:**
> - 실행 중인 모든 서버를 안전하게 종료하고 정리합니다.

---

---

## 3. 접속 방법 (Access) 🌐

서버가 켜졌다면(`make up`), 브라우저를 열고 아래 주소로 접속하세요:

- **프론트엔드 (React)**: [http://localhost:5173](http://localhost:5173)
- **미디어 서버 (API)**: [http://localhost:8080](http://localhost:8080)
- **AI 서버 (gRPC)**: 직접 접속 불가 (미디어 서버를 통해 통신)

> **팁:** WSL2를 사용 중이라도 Windows 브라우저에서 `localhost`로 접속하면 잘 됩니다!

---

## 4. 개발할 때 어떻게 하나요? 💻

서버를 켜두고(`make up`), 평소처럼 코드를 수정하면 됩니다.  
**"핫 리로딩(Hot Reloading)"** 기능이 있어서, 코드를 저장하면 자동으로 반영됩니다!

- **프론트엔드 (React)**: `apps/client-web` 코드를 수정하고 저장하면 브라우저가 새로고침 됩니다.
- **미디어 서버 (Go)**: `apps/server-media` 코드를 수정하면 서버가 자동으로 재시작됩니다.
- **AI 서버 (Python)**: `apps/server-ai` 코드를 수정하면 반영됩니다 (일부 경우 수동 재시작 필요).

### 특정 서버 로그만 보고 싶다면?
전체 로그가 너무 정신없다면, 보고 싶은 서버만 골라서 보세요:
```bash
make logs-client   # 프론트엔드 로그
make logs-media    # 미디어 서버 로그
make logs-ai       # AI 서버 로그
```

---

## 5. 문제 해결 (Troubleshooting) 🔧

### Q. `make up`을 했는데 포트 에러가 나요!
> `Error: bind: address already in use`

이미 다른 프로그램이 해당 포트를 쓰고 있어서 그렇습니다.
- **5173** (React), **8080** (Media), **50051** (AI) 포트를 쓰고 있는 다른 프로그램을 끄세요.
- 혹시 이전에 켠 Docker가 안 꺼졌을 수도 있으니 `make down`을 한번 하고 다시 해보세요.

### Q. 코드를 고쳤는데 반영이 안 돼요!
가끔 핫 리로딩이 꼬일 때가 있습니다. 그럴 땐:
```bash
make restart
```
명령어로 서버를 껐다 켜주세요.

### Q. 새로운 라이브러리를 설치했어요!
`package.json`이나 `go.mod`, `requirements.txt`가 바뀌었다면, 이미지를 다시 빌드해야 합니다:
```bash
make build
make up
```
단순히 코드만 바꾼 거라면 빌드할 필요 없습니다!

---

## 6. 전체 명령어 리스트 (참고용)

| 명령어 | 설명 |
| :--- | :--- |
| `make up` | 전체 서비스 시작 (권장) |
| `make down` | 전체 서비스 종료 |
| `make restart` | 전체 재시작 (`down` -> `up`) |
| `make logs` | 전체 로그 보기 |
| **개별 실행** | |
| `make up-client` | 프론트엔드만 실행 (포트 5173) |
| `make up-media` | 미디어 서버만 실행 (의존성 포함) |
| `make up-ai` | AI 서버만 실행 |
| **개별 재시작** | |
| `make restart-client` | 프론트엔드 재시작 |
| `make restart-media` | 미디어 서버 재시작 |
| `make restart-ai` | AI 서버 재시작 |
| **기타** | |
| `make ps` | 현재 실행 중인 컨테이너 상태 확인 |
| `make build` | Docker 이미지 새로 만들기 (라이브러리 추가 시) |
| `make shell-media` | 미디어 서버 내부 터미널로 접속 |
| `make clean` | 모든 데이터 및 임시 파일 정리 |

---

## 💡 팁
Windows 사용자인데 `make` 명령어가 안 먹힌다면?
- **WSL2 (Ubuntu)**를 사용하거나, **Git Bash** 터미널을 사용해보세요.
- 그래도 안 되면 `docker-compose up -d` 처럼 직접 docker 명령어를 써도 됩니다. (`Makefile` 파일을 열어보면 실제 명령어가 적혀있어요!)
