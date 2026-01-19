# 🐍 Python 팀(server-ai) 모노레포 적응 가이드

새로워진 **Media Streaming Platform Monorepo**에 오신 것을 환영합니다.
Python 팀이 가장 신경 써야 할 부분은 **공유 Proto import**와 **가상환경**입니다.

---

## 🏗 핵심 변경 사항

### 1. `shared-proto` 패키지 도입
더 이상 `generated` 폴더를 로컬에 복사해서 쓰지 않습니다.
- **이전:** `from generated import voice_pb2` (로컬 파일)
- **이후:** `from shared_proto import voice_pb2` (설치된 라이브러리)
- `packages/proto`가 `setup-ai` 명령어를 통해 **Editable Mode**(`-e`)로 설치됩니다. 즉, proto를 수정하고 컴파일하면 즉시 반영됩니다.

### 2. 표준화된 명령어 (Proxy 지원)
Go 팀과 마찬가지로, 앱 폴더(`apps/server-ai`) 내에서 `make` 명령어를 사용할 수 있습니다.
- **셋업:** `make setup` (가상환경 생성, 의존성 설치, Proto 연결)
- **실행:** `make dev`
- **테스트:** `make test`

### 3. Protobuf 생성 주의사항
절대로 혼자서 `python -m grpc_tools.protoc`를 실행하지 마세요.
- 반드시 `make proto` (루트 또는 앱 폴더)를 사용해야 합니다.
- 이 명령어가 Python의 고질적인 **Relative Import 문제**(`from . import ...`)를 자동으로 패치해줍니다.

---

## 👩‍💻 일일 개발 치트시트

`apps/server-ai` 폴더 안에서도, 루트에서도 실행 가능합니다.

| 상황 | 앱 폴더에서 (`make ...`) | 루트에서 (`make ...`) |
| :--- | :--- | :--- |
| **셋업 (필수)** | `make setup` | `make setup-ai` |
| **Proto 생성** | `make proto` | `make proto` |
| **서버 실행** | `make dev` | `make dev-ai` |
| **테스트** | `make test` | `make test-ai` |

---

## ⚠️ 중요 참고사항

### 테스트 누락
현재 `make test`를 실행하면 "수집된 테스트 없음"이 뜹니다.
- `tests/test_client.py`는 `pytest`가 인식하는 파일명 규칙이나 형식(함수형/클래스형 테스트)을 따르지 않기 때문입니다.
- 빠른 시일 내에 정식 유닛 테스트를 작성해주세요.

### Docker 빌드
- `apps/server-ai/Dockerfile`은 이제 루트 컨텍스트에서 빌드됩니다.
- 빌드 시 `packages/proto`를 자동으로 마운트하므로, `requirements.txt`의 상대 경로 의존성이 정상적으로 해결됩니다.
