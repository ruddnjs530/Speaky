# AI 모델 등록 가이드

이 문서는 AI 모델 담당자가 새로운 RVC 음성 변환 모델을 등록할 때 따라야 할 단계별 가이드입니다.

> 📌 **현재 환경**: 로컬 개발 환경 사용 중  
> ⚠️ **EC2 배포**: 향후 배포 시 사용할 내용은 별도로 표시되어 있습니다.

---

## 📋 사전 준비사항

### 필요한 파일
- ✅ 학습 완료된 모델 파일 (`.pth`)
- ✅ 인덱스 파일 (`.index`) - 선택사항이지만 권장

### 필요한 정보
- ✅ 모델 이름 (models.yaml의 `model_name`에 사용)
- ✅ 사용할 `voice_model_id` (기존 모델과 중복되지 않는 번호)

### 필요한 작업 환경
- ✅ 프로젝트 저장소 클론 및 수정 가능 (models.yaml 파일 수정)
- ✅ Docker 컨테이너 실행/재시작 가능
- ⚠️ EC2 또는 배포 서버 접근 권한 - 배포 환경에서만 필요

---

## 🔧 환경 설정 (최초 1회만)

### RVC_ASSETS_PATH 환경변수 설정

모델 파일을 배치하기 전에 `RVC_ASSETS_PATH` 환경변수를 설정해야 합니다.

#### 1. 프로젝트 루트에 `.env` 파일 생성/수정

```bash
# 프로젝트 루트 디렉토리 (S14P11B103/)에 .env 파일 생성
```

#### 2. .env 파일에 경로 추가

```bash
# .env 파일 내용
RVC_ASSETS_PATH=/path/to/your/rvc/assets
RVC_CODE_INFER_PATH=/path/to/your/rvc/infer
RVC_CODE_CONFIGS_PATH=/path/to/your/rvc/configs
```

**각 경로에 포함되어야 할 파일:**

- **`RVC_ASSETS_PATH`** (예: `/path/to/rvc/assets/`)
  - `weights/` - 학습된 모델 파일 (`.pth`)
  - `indices/` - 인덱스 파일 (`.index`, 선택사항)
  - `hubert/` - HuBERT 모델 파일 (RVC가 자동으로 다운로드)

- **`RVC_CODE_INFER_PATH`** (예: `/path/to/rvc/infer/`)
  - RVC 추론 코드 (Python 모듈들)
  - `infer/modules/`, `infer/lib/` 등

- **`RVC_CODE_CONFIGS_PATH`** (예: `/path/to/rvc/configs/`)
  - RVC 설정 파일들
  - `config.json`, `configs.yaml` 등

**경로 예시:**
- **Windows**: `RVC_ASSETS_PATH=C:/Users/SSAFY/Retrieval-based-Voice-Conversion-WebUI/assets`
- **Linux/Mac**: `RVC_ASSETS_PATH=/home/사용자명/Retrieval-based-Voice-Conversion-WebUI/assets`

> 💡 **참고**: `RVC_ASSETS_PATH`는 RVC WebUI의 `assets` 폴더 경로입니다.  
> 이 경로는 Docker 컨테이너 내부의 `/rvc-code/assets`로 마운트됩니다.

---

## 🚀 모델 등록 절차

### 1단계: 모델 파일 업로드

#### 로컬 개발 환경 (현재 사용 중)

**모델 파일 배치 위치:**

```bash
# 호스트 경로 (Windows 예시)
# C:/Users/SSAFY/Retrieval-based-Voice-Conversion-WebUI/assets/weights/새모델.pth
# C:/Users/SSAFY/Retrieval-based-Voice-Conversion-WebUI/assets/indices/새모델.index

# 모델 파일 복사
cp 새모델.pth ${RVC_ASSETS_PATH}/weights/
cp 새모델.index ${RVC_ASSETS_PATH}/indices/  # 인덱스가 있는 경우
```

**경로 확인:**

```bash
# .env 파일에서 설정한 경로 확인
echo ${RVC_ASSETS_PATH}

# 파일이 올바른 위치에 있는지 확인
ls ${RVC_ASSETS_PATH}/weights/새모델.pth
ls ${RVC_ASSETS_PATH}/indices/새모델.index  # 인덱스가 있는 경우
```

> 📌 **중요**: 
> - **호스트 경로**: `${RVC_ASSETS_PATH}/weights/` (`.env` 파일에 설정한 경로)
> - **Docker 컨테이너 내부 경로**: `/rvc-code/assets/weights/` (models.yaml에서 사용)

#### EC2 배포 환경 (향후 배포 시 사용)

> ⚠️ **참고**: 현재는 로컬 개발 환경을 사용 중입니다. EC2 배포 시 아래 방법을 사용하세요.

```bash
# EC2 인스턴스에 접속
ssh -i your-key.pem ubuntu@your-ec2-ip

# 모델 파일 업로드 (로컬에서)
scp -i your-key.pem 새모델.pth ubuntu@ec2-ip:/opt/rvc/assets/weights/
scp -i your-key.pem 새모델.index ubuntu@ec2-ip:/opt/rvc/assets/indices/  # 인덱스가 있는 경우

# 또는 S3 사용 시
aws s3 cp 새모델.pth s3://your-bucket/rvc-assets/weights/
aws s3 cp 새모델.index s3://your-bucket/rvc-assets/indices/
```

#### 파일 확인

```bash
# Docker 컨테이너 내부에서 확인
docker-compose exec server-ai ls -la /rvc-code/assets/weights/새모델.pth
docker-compose exec server-ai ls -la /rvc-code/assets/indices/새모델.index
```

---

### 2단계: models.yaml 수정

#### 파일 위치
```
apps/server-ai/src/config/models.yaml
```

#### 추가할 항목

```yaml
models:
  # ... 기존 모델들 ...
  
  - model_name: "새 모델 이름"              # 모델의 표시 이름 (고유해야 함)
    voice_model_id: 5                       # 다음 사용 가능한 ID (중복 불가)
    model_path: "/rvc-code/assets/weights/새모델.pth"
    index_path: "/rvc-code/assets/indices/새모델.index"  # 인덱스가 있는 경우
    index_rate: 0.75                        # 인덱스 사용 비율 (0.0 ~ 1.0)
    pitch: 0                                # 피치 조정 (-12 ~ 12)
    protect: 0.33                           # 보호 비율 (0.0 ~ 0.5)
    rms_mix_rate: 1.0                       # RMS 믹스 비율 (0.0 ~ 1.0)
    device: "cuda"                          # "cuda" 또는 "cpu"
```

> 📌 **경로 주의사항**: 
> - `model_path`와 `index_path`는 **Docker 컨테이너 내부 경로**를 사용합니다.
> - 호스트 경로 `${RVC_ASSETS_PATH}/weights/새모델.pth`가 컨테이너 내부에서 `/rvc-code/assets/weights/새모델.pth`로 마운트됩니다.
> - 따라서 `models.yaml`에는 항상 `/rvc-code/assets/...` 경로를 사용해야 합니다.
```

#### voice_model_id 결정 방법

```bash
# 기존 모델들의 voice_model_id 확인
cat apps/server-ai/src/config/models.yaml | grep voice_model_id

# 다음 사용 가능한 ID = (최대값 + 1)
# 예: 현재 최대값이 4면 → 다음 ID는 5
```

#### 인덱스 파일이 없는 경우

```yaml
- model_name: "새 모델 이름"
  voice_model_id: 5
  model_path: "/rvc-code/assets/weights/새모델.pth"
  # index_path는 생략
  index_rate: 0.0  # 인덱스 없으므로 0.0
  pitch: 0
  protect: 0.33
  rms_mix_rate: 1.0
  device: "cuda"
```

---

### 3단계: 설정 파라미터 설명

| 파라미터 | 설명 | 권장값 | 범위 |
|---------|------|--------|------|
| `model_name` | 모델의 표시 이름 (고유해야 함) | 모델을 식별할 수 있는 이름 | - |
| `voice_model_id` | Media 서버에서 사용할 ID | 1부터 시작, 중복 불가 | 1 이상 |
| `model_path` | 모델 가중치 파일의 절대 경로 | `/rvc-code/assets/weights/모델명.pth` | - |
| `index_path` | 인덱스 파일 경로 (선택) | `/rvc-code/assets/indices/모델명.index` | - |
| `index_rate` | 인덱스 사용 비율 | 0.75 (인덱스 있음), 0.0 (인덱스 없음) | 0.0 ~ 1.0 |
| `pitch` | 피치 조정 값 | 0 (기본값) | -12 ~ 12 |
| `protect` | 보호 비율 (너무 낮으면 음질 저하) | 0.33 (기본값) | 0.0 ~ 0.5 |
| `rms_mix_rate` | RMS 믹스 비율 | 1.0 (기본값) | 0.0 ~ 1.0 |
| `device` | 사용할 디바이스 | "cuda" (GPU 있음), "cpu" (GPU 없음) | "cuda" 또는 "cpu" |

---

### 4단계: 서버 재시작

#### 로컬 개발 환경

```bash
# Docker Compose로 재시작
docker-compose restart server-ai

# 또는 완전히 재시작
docker-compose down server-ai
docker-compose up -d server-ai
```

#### EC2 배포 환경 (향후 배포 시 사용)

> ⚠️ **참고**: 현재는 로컬 개발 환경을 사용 중입니다.

```bash
# EC2에서
cd /path/to/project
docker-compose restart server-ai

# 또는
docker-compose down server-ai
docker-compose up -d server-ai
```

---

### 5단계: 모델 로딩 확인

#### 로그 확인

```bash
# 서버 로그 확인
docker-compose logs -f server-ai

# 다음 메시지가 보이면 성공:
# [AI Worker] Loading X models...
# [AI Worker] Model loaded: 새 모델 이름
# [AI Worker]   Target Sample Rate: 40000Hz
# [AI Worker] Loaded models: [..., '새 모델 이름', ...]
# [AI Worker] gRPC server started at 0.0.0.0:50051 (RVC=ON)
```

#### GetStatus API로 확인

```bash
# gRPC 클라이언트로 상태 확인
# 또는 테스트 스크립트 실행
python apps/server-ai/tests/test_voice_conversion.py
```

#### 에러 발생 시

```
[ERROR] Failed to load model 새 모델 이름: ...
```

- 파일 경로 확인
- 파일 권한 확인
- models.yaml 문법 확인

---

## ✅ 체크리스트

모델 등록 전 확인사항:

- [ ] 모델 파일 (`.pth`)이 올바른 위치에 있는가?
- [ ] 인덱스 파일 (`.index`)이 있다면 올바른 위치에 있는가?
- [ ] `voice_model_id`가 중복되지 않는가?
- [ ] `model_path`가 Docker 컨테이너 내부 경로인가? (`/rvc-code/...`)
- [ ] `models.yaml` 문법이 올바른가? (YAML 들여쓰기 확인)
- [ ] 서버 재시작 후 로그에서 모델이 로딩되었는가?
- [ ] `voice_model_id`로 모델 선택이 정상 동작하는가?

---

## 🔧 문제 해결

### 문제 1: 모델이 로딩되지 않음

**증상:**
```
[ERROR] Failed to load model 새 모델 이름: FileNotFoundError
```

**해결:**
```bash
# 1. 파일 경로 확인
docker-compose exec server-ai ls -la /rvc-code/assets/weights/새모델.pth

# 2. models.yaml 경로 확인
docker-compose exec server-ai cat /app/src/config/models.yaml | grep 새모델

# 3. 파일 권한 확인
docker-compose exec server-ai ls -la /rvc-code/assets/weights/
```

---

### 문제 2: voice_model_id 중복

**증상:**
```
[WARNING] voice_model_id X is already registered
```

**해결:**
```bash
# 기존 voice_model_id 확인
cat apps/server-ai/src/config/models.yaml | grep voice_model_id

# 사용 가능한 다음 ID 사용
```

---

### 문제 3: 인덱스 차원 불일치

**증상:**
```
[WARNING] Index dimension mismatch for model. Retrying without index.
```

**해결:**
- 해당 모델의 인덱스 파일이 다른 모델의 인덱스일 가능성
- 올바른 인덱스 파일로 교체
- 또는 `index_rate: 0.0`으로 설정하여 인덱스 비활성화

---

### 문제 4: GPU 메모리 부족

**증상:**
```
CUDA out of memory
```

**해결:**
- 모델 개수 줄이기
- 일부 모델을 `device: "cpu"`로 변경
- GPU 메모리가 더 큰 인스턴스 사용

---

## 📝 예시: 완전한 등록 과정

### 예시 1: "Korone Voice" 모델 등록 (로컬 개발 환경)

```bash
# 1. 파일 업로드 (로컬 개발 환경)
cp Korone.pth ${RVC_ASSETS_PATH}/weights/
cp korone1.index ${RVC_ASSETS_PATH}/indices/

# 2. models.yaml 수정
# apps/server-ai/src/config/models.yaml에 추가:
#   - model_name: "Korone Voice"
#     voice_model_id: 1
#     model_path: "/rvc-code/assets/weights/Korone.pth"
#     index_path: "/rvc-code/assets/indices/korone1.index"
#     index_rate: 0.75
#     pitch: 0
#     protect: 0.33
#     rms_mix_rate: 1.0
#     device: "cuda"

# 3. Git 커밋 및 푸시
git add apps/server-ai/src/config/models.yaml
git commit -m "feat: add Korone Voice model"
git push

# 4. 서버 재시작
docker-compose restart server-ai

# 5. 로그 확인
docker-compose logs -f server-ai
# [AI Worker] Model loaded: Korone Voice
# [AI Worker]   Target Sample Rate: 40000Hz
```

### 예시 2: EC2 배포 환경 (향후 배포 시 사용)

> ⚠️ **참고**: 현재는 로컬 개발 환경을 사용 중입니다. EC2 배포 시 아래 방법을 사용하세요.

```bash
# 1. 파일 업로드 (EC2)
scp Korone.pth ubuntu@ec2-ip:/opt/rvc/assets/weights/
scp korone1.index ubuntu@ec2-ip:/opt/rvc/assets/indices/

# 2-5단계는 로컬 개발 환경과 동일
```

---

## 🎯 모델 업데이트

기존 모델을 새 버전으로 교체할 때:

1. **새 모델 파일로 교체**
   ```bash
   # 기존 파일 백업 (선택)
   mv /opt/rvc/assets/weights/기존모델.pth /opt/rvc/assets/weights/기존모델.pth.bak
   
   # 새 파일 업로드
   scp 새모델.pth ubuntu@ec2-ip:/opt/rvc/assets/weights/기존모델.pth
   ```

2. **서버 재시작**
   ```bash
   docker-compose restart server-ai
   ```

3. **확인**
   - 로그에서 모델이 정상 로딩되는지 확인
   - 테스트로 변환 품질 확인

---

## 📞 문의

문제가 발생하거나 도움이 필요하면:
- AI Server 담당자에게 문의
- GitLab Issue 생성
- 팀 채널에 문의

---

## 📚 참고 자료

- [AI Server README](./README.md)
- [RVC WebUI 공식 문서](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI)
- [모델 학습 가이드](./MODEL_TRAINING_GUIDE.md) (작성 예정)
