# 🐹 Go 팀(server-media) 모노레포 적응 가이드

새로워진 **Media Streaming Platform Monorepo**에 오신 것을 환영합니다.
Go 팀이 기존의 편리함(Air, VSCode 등)을 유지하면서 모노레포에 적응하는 방법을 안내합니다.

---

## 🏗 핵심 변경 사항

### 1. 통합된 Makefile과 로컬 Proxy
기존의 로컬 `Makefile`은 삭제되었지만, 편의를 위해 **Proxy Makefile**을 만들어 두었습니다.
- **루트에서:** `make dev-media`
- **앱 폴더에서:** `cd apps/server-media` 후 `make dev`
- **결과:** 둘 다 똑같이 루트의 설정(Air 실행)을 호출합니다.

### 2. Git Hooks 통합 (Lefthook)
`lefthook.yml`이 루트로 이동했습니다.
- 이제 여러분의 코드는 Python, React 팀과 동일한 수준의 검사를 받습니다.
- **필수:** 루트에서 `npm install && npx lefthook install`을 실행하세요.

### 3. Docker 컨텍스트 변경
- `packages/proto`를 공유하기 위해, Docker 빌드는 이제 **루트 디렉토리**를 컨텍스트로 사용합니다.
- 로컬 `Dockerfile`은 수정되었으니, 직접 수정하지 마세요.

---

## 👩‍💻 일일 개발 치트시트

`apps/server-media` 폴더 안에서도, 루트에서도 실행 가능합니다.

| 상황 | 앱 폴더에서 (`make ...`) | 루트에서 (`make ...`) |
| :--- | :--- | :--- |
| **셋업** | `make setup` | `make setup-media` |
| **서버 실행 (Air)** | `make dev` | `make dev-media` |
| **린트 (Revive)** | `make lint` | `make lint-go` |
| **포맷팅** | `make fmt` | `make fmt-go` |
| **Proto 생성** | `make proto` | `make proto` |

---

## ⚠️ VSCode 및 툴링

### VSCode 설정
- `apps/server-media` 폴더를 VSCode로 열면, 기존처럼 `.vscode` 설정(Format on Save 등)이 **그대로 동작합니다.**
- 루트 폴더를 열 경우, VSCode가 하위 폴더 설정을 무시할 수 있으니 주의하세요.

### Proto 파일 관리
- **Single Source of Truth:** `packages/proto` 폴더가 유일한 원본입니다.
- `apps/server-media` 내부에 proto 파일을 복사하지 마세요.
- `make proto`를 실행하면 `packages/proto/generated`가 업데이트되고, Go 모듈이 이를 참조합니다.
