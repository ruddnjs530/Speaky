# 👋 프론트엔드 팀(client-web) 모노레포 적응 가이드

새로워진 **Media Streaming Platform Monorepo**에 오신 것을 환영합니다.
이 문서는 React 팀이 새로운 환경에서 어떻게 개발해야 하는지 설명합니다.

---

## 🏗 핵심 변경 사항

### 1. 루트 기반 워크플로우 (Run from Root)
이제 프로젝트 루트(`root`)가 모든 동작의 기준점이 됩니다.
하지만 `apps/client-web` 폴더 안에서도 `npm run dev` 등의 명령어는 여전히 동작합니다.

### 2. 표준화된 명령어 (Makefile)
모든 팀이 공통된 명령어를 사용합니다.
- **초기 셋업:** `make setup-client` (또는 `make setup-all`)
- **빌드:** `make build-client`
- **전체 실행:** `make docker-up`

### 3. Docker 표준화
- 배포 아티팩트는 **Multi-Stage Dockerfile**로 표준화되었습니다.
- 로컬에서 프로덕션 빌드를 테스트하려면 `make docker-build`를 실행하세요.

### 4. Git Hooks (Lefthook)
- 커밋 시 자동으로 린트가 실행됩니다.
- **필수:** 루트에서 `npm install && npx lefthook install`을 한 번 실행해주세요.

---

## 👩‍💻 일일 개발 치트시트

터미널을 **루트(/)**에 두고 사용하시면 편리합니다.

| 상황 | 명령어 | 설명 |
| :--- | :--- | :--- |
| **처음 시작할 때** | `make setup-all` | 내 의존성 + 백엔드 의존성 모두 설치 |
| **FE만 셋업할 때** | `make setup-client` | `npm install`과 동일 |
| **개발 서버 시작** | `make dev-client` | `npm run dev` (Vite) 실행 |
| **프로덕션 빌드** | `make build-client` | `tsc` 확인 및 빌드 |
| **전체 스택 실행** | `make docker-up` | React + Go + Python + DB 컨테이너 실행 |

---

## ⚠️ 문제 해결

### "Missing Script: test" 오류
- 현재 `make test-client` 실행 시 실패합니다.
- 원인: `package.json`에 `test` 스크립트가 없습니다.
- 해결: Jest나 Vitest 설정 후 스크립트를 추가하면 `make test-client`도 정상 작동합니다.

### "node_modules가 루트에도 있나요?"
- 네, 하지만 루트의 `node_modules`는 오직 `lefthook` 같은 공용 관리 도구용입니다.
- 여러분의 React 라이브러리는 여전히 `apps/client-web/node_modules`에 격리되어 있습니다.
