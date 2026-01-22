# RVC 환경 설정 가이드

이 문서는 AI 서버에서 RVC(Retrieval-based Voice Conversion) 모델을 사용하기 위한 환경 설정 방법을 설명합니다.

---

## 개요

RVC 모델을 사용하려면 다음이 필요합니다:

1. **RVC WebUI 프로젝트**: Retrieval-based-Voice-Conversion-WebUI 코드
2. **RVC Assets**: 모델 파일(.pth), 인덱스 파일(.index), HuBERT, RMVPE 등
3. **환경 변수 설정**: `.env` 파일에 경로 설정

---

## 빠른 시작

### 1단계: .env 파일 생성

프로젝트 루트(`S14P11B103`)에 `.env` 파일을 생성하세요:

```bash
# .env.example 파일을 복사
cp .env.example .env
```

또는 직접 `.env` 파일을 만들어도 됩니다.

### 2단계: RVC WebUI 경로 설정

`.env` 파일을 열어서 본인의 RVC WebUI 경로로 수정하세요.

---

## .env 파일 설정

### Windows 사용자

```bash
# .env 파일
RVC_ASSETS_PATH=C:/Users/본인계정/Retrieval-based-Voice-Conversion-WebUI/assets
RVC_CODE_INFER_PATH=C:/Users/본인계정/Retrieval-based-Voice-Conversion-WebUI/infer
RVC_CODE_CONFIGS_PATH=C:/Users/본인계정/Retrieval-based-Voice-Conversion-WebUI/configs
```

**주의사항:**
- 슬래시(`/`) 사용 권장 (백슬래시 `\` 대신)
- 경로에 공백이 있으면 따옴표로 감싸기
- 예: `C:/Users/My Name/...` → `"C:/Users/My Name/..."`

### Linux/Mac 사용자

```bash
# .env 파일
RVC_ASSETS_PATH=/home/사용자/Retrieval-based-Voice-Conversion-WebUI/assets
RVC_CODE_INFER_PATH=/home/사용자/Retrieval-based-Voice-Conversion-WebUI/infer
RVC_CODE_CONFIGS_PATH=/home/사용자/Retrieval-based-Voice-Conversion-WebUI/configs
```

---

## 필요한 파일 구조

RVC WebUI 프로젝트에는 다음 폴더/파일이 있어야 합니다:

```
Retrieval-based-Voice-Conversion-WebUI/
├── assets/
│   ├── hubert/
│   │   └── hubert_base.pt          # 필수
│   ├── rmvpe/
│   │   └── rmvpe.pt                # 필수
│   ├── weights/
│   │   └── *.pth                   # 모델 파일들
│   └── indices/
│       └── *.index                 # 인덱스 파일들 (선택)
├── infer/                           # 필수
│   └── modules/
│       └── vc/
└── configs/                         # 필수
    └── config.py
```

---

## 설정 확인

### 1. .env 파일 확인

```bash
# 프로젝트 루트에서
cat .env
```

경로가 올바르게 설정되었는지 확인하세요.

### 2. Docker 컨테이너 내부에서 확인

```bash
# 서버 실행 후
docker-compose exec server-ai ls -la /rvc-assets/weights/
docker-compose exec server-ai ls -la /rvc-code/infer/
```

파일 목록이 보이면 정상적으로 마운트된 것입니다.

### 3. 모델 로딩 확인

서버 로그에서 모델 로딩 메시지를 확인하세요:

```
[AI Worker] Loading 4 models...
[AI Worker] Model loaded: Korone Voice
[AI Worker] Model loaded: Test Voice 1
...
```

---

## 문제 해결

### 문제 1: 경로를 찾을 수 없음

**증상:**
```
FileNotFoundError: assets 폴더를 찾지 못했습니다
```

**해결 방법:**
1. `.env` 파일의 경로가 올바른지 확인
2. 경로에 공백이나 특수문자가 있는지 확인
3. Windows는 슬래시(`/`) 사용 권장
4. 절대 경로인지 확인 (상대 경로 사용 안 됨)

### 문제 2: 모델이 로드되지 않음

**증상:**
```
[ERROR] Failed to load model: model_path가 존재하지 않습니다
```

**해결 방법:**
1. `models.yaml`의 경로가 `/rvc-assets/...` 형식인지 확인
2. 실제 모델 파일이 존재하는지 확인:
   ```bash
   docker-compose exec server-ai ls -la /rvc-assets/weights/
   ```
3. 파일 권한 확인 (읽기 권한 필요)

### 문제 3: Docker 볼륨 마운트 실패

**증상:**
```
Error response from daemon: invalid mount config
```

**해결 방법:**
1. `.env` 파일의 경로 형식 확인
2. Windows: `C:/Users/...` 형식 사용
3. 경로에 공백이 있으면 따옴표로 감싸기
4. Docker Desktop이 실행 중인지 확인

### 문제 4: 환경 변수가 적용되지 않음

**증상:**
- `.env` 파일을 수정했는데 변경사항이 반영되지 않음

**해결 방법:**
1. Docker 컨테이너 재시작:
   ```bash
   docker-compose down
   docker-compose up
   ```
2. `.env` 파일이 프로젝트 루트에 있는지 확인
3. 파일명이 정확히 `.env`인지 확인 (`.env.txt` 아님)

---

## 추가 정보

### models.yaml 설정

모델 설정은 `apps/server-ai/src/config/models.yaml`에서 관리합니다.

```yaml
models:
  - model_id: "Korone Voice"
    model_path: "/rvc-assets/weights/Korone.pth"
    index_path: "/rvc-assets/indices/index.index"
    index_rate: 0.75
    pitch: 0
    device: "cuda"
```

**중요:** `model_path`와 `index_path`는 Docker 컨테이너 내부 경로(`/rvc-assets/...`)를 사용해야 합니다.

### 환경 변수 목록

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `RVC_ASSETS_PATH` | RVC assets 폴더 경로 (모델, 인덱스, HuBERT 등) | `C:/Users/.../assets` |
| `RVC_CODE_INFER_PATH` | RVC infer 코드 폴더 경로 | `C:/Users/.../infer` |
| `RVC_CODE_CONFIGS_PATH` | RVC configs 폴더 경로 | `C:/Users/.../configs` |

---

## 팁

1. **경로 확인**: 설정 후 반드시 Docker 컨테이너 내부에서 파일이 보이는지 확인하세요
2. **모델 추가**: 새 모델을 추가할 때는 `models.yaml`만 수정하면 됩니다
3. **Git 주의**: `.env` 파일은 Git에 커밋하지 마세요 (`.gitignore`에 포함됨)
4. **템플릿 사용**: `.env.example` 파일을 복사해서 사용하면 실수 방지

---

## 관련 문서

- [Docker 가이드](docker-guide.md)
- [AI 서버 워크플로우](workflow-server-ai.md)
