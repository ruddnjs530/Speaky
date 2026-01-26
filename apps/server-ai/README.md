# AI Server

RVC (Retrieval-based Voice Conversion) 모델을 사용한 음성 변환 AI 서버입니다.

## 기능

- RVC 모델을 사용한 실시간 음성 변환
- voice_model_id 기반 동적 모델 선택
- 다중 모델 동시 로딩 및 관리
- GPU 지원 (CUDA)
- gRPC 스트리밍 API

## 실행 가이드

### 사전 요구사항

- Docker & Docker Compose
- NVIDIA GPU (선택, CPU도 가능)
- NVIDIA Container Toolkit (GPU 사용 시)
- RVC WebUI 코드 및 모델 파일

### 1. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하세요:

```bash
# .env 파일
RVC_ASSETS_PATH=/path/to/your/rvc/assets
RVC_CODE_INFER_PATH=/path/to/your/rvc/infer
RVC_CODE_CONFIGS_PATH=/path/to/your/rvc/configs
```

**경로 예시:**
- Windows: `RVC_ASSETS_PATH=C:/Users/사용자명/Retrieval-based-Voice-Conversion-WebUI/assets`
- Linux/Mac: `RVC_ASSETS_PATH=/home/사용자명/Retrieval-based-Voice-Conversion-WebUI/assets`

### 2. RVC 파일 준비

RVC WebUI 디렉토리 구조:

```
/path/to/rvc/
├── assets/
│   ├── weights/          # .pth 모델 파일들
│   └── indices/          # .index 파일들 (선택)
├── infer/                # RVC 추론 코드
└── configs/              # RVC 설정 파일
```

### 3. 모델 파일 준비

학습한 모델 파일을 다음 위치에 배치하세요:

- **모델 파일**: `{RVC_ASSETS_PATH}/weights/모델이름.pth`
- **인덱스 파일** (선택): `{RVC_ASSETS_PATH}/indices/모델이름.index`

### 4. models.yaml 설정

`apps/server-ai/src/config/models.yaml` 파일을 수정하세요:

```yaml
models:
  - model_name: "모델 이름"
    voice_model_id: 1                    # 1부터 시작 (0은 미설정)
    model_path: "/rvc-code/assets/weights/모델파일.pth"
    index_path: "/rvc-code/assets/indices/인덱스파일.index"  # 선택
    index_rate: 0.75                     # 인덱스 사용 비율 (0.0 ~ 1.0)
    pitch: 0                             # 피치 조정 (-12 ~ 12)
    protect: 0.33                         # 보호 비율 (0.0 ~ 0.5)
    rms_mix_rate: 1.0                    # RMS 믹스 비율 (0.0 ~ 1.0)
    device: "cuda"                        # "cuda" 또는 "cpu"
```

**인덱스 파일이 없는 경우:**
```yaml
  - model_name: "모델 이름"
    voice_model_id: 1
    model_path: "/rvc-code/assets/weights/모델파일.pth"
    # index_path 생략
    index_rate: 0.0                       # 인덱스 없으면 0.0
    pitch: 0
    protect: 0.33
    rms_mix_rate: 1.0
    device: "cuda"
```

### 5. Proto 파일 생성

```bash
# 프로젝트 루트에서
make proto

# 또는
./scripts/gen-proto.sh
```

### 6. AI 서버 실행

```bash
# 프로젝트 루트에서
docker-compose up server-ai

# 또는 백그라운드로
docker-compose up -d server-ai

# 로그 확인
docker-compose logs -f server-ai
```

### 7. 실행 확인

정상 실행 시 다음과 같은 로그가 보입니다:

```
[AI Worker] Loading X models...
[AI Worker] Model loaded: 모델이름
...
[AI Worker] Loaded models: ['모델1', '모델2', ...]
[AI Worker] gRPC server started at 0.0.0.0:50051 (RVC=ON)
```

## 빠른 체크리스트

- [ ] `.env` 파일 생성 및 RVC 경로 설정
- [ ] RVC WebUI 파일 준비 (assets, infer, configs)
- [ ] 모델 파일 배치 (.pth, .index)
- [ ] `models.yaml`에 모델 정보 추가
- [ ] Proto 파일 생성 (`make proto`)
- [ ] `docker-compose up server-ai` 실행

## 새 모델 추가하기

> 📖 **상세 가이드**: [모델 등록 가이드](./MODEL_REGISTRATION_GUIDE.md) 참고

1. **모델 파일 준비**
   - 학습한 `.pth` 파일을 `{RVC_ASSETS_PATH}/weights/`에 배치
   - 인덱스 파일이 있으면 `{RVC_ASSETS_PATH}/indices/`에 배치

2. **models.yaml에 추가**
   ```yaml
   - model_name: "새 모델 이름"
     voice_model_id: 5                    # 다음 번호
     model_path: "/rvc-code/assets/weights/새모델.pth"
     index_path: "/rvc-code/assets/indices/새모델.index"  # 선택
     index_rate: 0.75
     pitch: 0
     protect: 0.33
     rms_mix_rate: 1.0
     device: "cuda"
   ```

3. **서버 재시작**
   ```bash
   docker-compose restart server-ai
   ```

## 설정 파라미터 설명

| 파라미터 | 설명 | 범위 |
|---------|------|------|
| `model_name` | 모델의 표시 이름 (고유해야 함) | - |
| `voice_model_id` | Media 서버에서 사용할 ID (1부터 시작, 중복 불가) | 1 이상 |
| `model_path` | 모델 가중치 파일의 절대 경로 | - |
| `index_path` | 인덱스 파일 경로 (선택) | - |
| `index_rate` | 인덱스 사용 비율 (0.0 = 사용 안 함, 0.75 = 75% 사용) | 0.0 ~ 1.0 |
| `pitch` | 피치 조정 값 (음수 = 낮게, 양수 = 높게) | -12 ~ 12 |
| `protect` | 보호 비율 (너무 낮으면 음질 저하 가능) | 0.0 ~ 0.5 |
| `rms_mix_rate` | RMS 믹스 비율 | 0.0 ~ 1.0 |
| `device` | 사용할 디바이스 | "cuda" 또는 "cpu" |

## 문제 해결

### 모델이 로딩되지 않는 경우

```bash
# 컨테이너 내부에서 경로 확인
docker-compose exec server-ai ls -la /rvc-code/assets/weights/
docker-compose exec server-ai cat /app/src/config/models.yaml
```

### GPU가 인식되지 않는 경우

1. **NVIDIA 드라이버 확인**
   ```bash
   nvidia-smi
   ```

2. **NVIDIA Container Toolkit 설치 확인**
   ```bash
   docker run --rm --gpus all nvidia/cuda:11.0.3-base-ubuntu20.04 nvidia-smi
   ```

3. **CPU 모드로 실행**
   - `models.yaml`에서 `device: "cpu"`로 변경
   - `docker-compose.yml`에서 GPU 설정 제거 또는 주석 처리

### 서버가 시작되지 않는 경우

```bash
# 로그 확인
docker-compose logs server-ai

# 컨테이너 상태 확인
docker-compose ps

# 컨테이너 내부에서 직접 실행
docker-compose exec server-ai python -m src.server
```

### Proto 파일 문제

```bash
# Proto 파일 재생성
make proto

# 또는
./scripts/gen-proto.sh

# 생성된 파일 확인
ls packages/proto/generated/python/
```

## API

### GetStatus

서버 상태 확인

```python
from voice_pb2 import StatusRequest
from voice_pb2_grpc import VoiceServiceStub

status = await stub.GetStatus(StatusRequest())
# 반환: "READY", "LOADING", "ERROR"
```

### ConvertStream

오디오 스트림 변환 (양방향 스트리밍)

```python
from voice_pb2 import AudioChunk

# voice_model_id를 포함한 AudioChunk 전송
chunk = AudioChunk(
    pcm=audio_data,
    sample_rate=16000,
    channels=1,
    voice_model_id=1  # 사용할 모델 ID
)

async for response in stub.ConvertStream([chunk]):
    # 변환된 오디오 데이터 수신
    processed_audio = response.pcm
```

## 주의사항

1. **GPU 사용 시**: NVIDIA 드라이버 및 NVIDIA Container Toolkit 필요
2. **CPU 사용 시**: `models.yaml`에서 `device: "cpu"`로 변경
3. **경로 확인**: `.env`의 경로가 실제 파일 위치와 일치해야 함
4. **모델 파일**: `models.yaml`의 경로가 Docker 컨테이너 내부 경로(`/rvc-code/...`)와 일치해야 함
5. **voice_model_id**: 1부터 시작 (0은 "미설정"으로 처리되어 첫 번째 READY 모델 사용)
