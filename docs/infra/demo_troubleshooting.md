# Demo Troubleshooting Guide

## AI Server (server-ai) 무한 다운로드 문제

시연(`make demo`) 실행 시 AI 서버가 계속해서 리소스를 다운로드하는 경우, 주로 **Volume Mount** 설정이나 **파일 경로 불일치**가 원인입니다. 아래 체크리스트를 순서대로 확인해 주세요.

### 1. 로그 확인 (무엇을 다운로드하는가?)
가장 먼저 다운로드 시도 중인 파일명을 확인해야 합니다.
```bash
docker-compose logs -f server-ai
```
*   **Case A**: `hubert_base.pt` 또는 `rmvpe.pt` 다운로드 중
    *   기본 모델 파일이 컨테이너 내 정확한 위치에 없다는 뜻입니다.
*   **Case B**: `ffmpeg`, `aria2` 등 시스템 패키지 설치 중
    *   Dockerfile 단계에서 캐시가 깨졌거나 재빌드 중인 상황입니다.

### 2. 환경 변수 및 호스트 경로 확인
`.env` 파일에 설정된 자산(Assets) 경로가 실제 파일을 포함하고 있는지 확인합니다.

```bash
# .env 확인
cat .env | grep RVC_ASSETS_PATH

# 실제 파일 존재 여부 (예시 경로)
ls -R /home/iidx/Retrieval-based-Voice-Conversion-WebUI/assets/hubert
# -> hubert_base.pt 파일이 보여야 함
```
만약 `hubert_base.pt`가 `assets/` 바로 아래가 아니라 `assets/hubert/` 안에 있다면, 컨테이너 내부 코드도 동일한 구조를 기대하는지 확인이 필요합니다.

### 3. Docker Volume Mount 확인
`docker-compose.yml`에서 마운트 설정이 올바른지 확인합니다.

```yaml
    volumes:
      - ${RVC_ASSETS_PATH:-./rvc-models/assets}:/rvc-code/assets:ro
```
*   **확인 포인트**:
    1.  컨테이너 내부 경로 `/rvc-code/assets`가 맞는지? (RVC 버전에 따라 다를 수 있음)
    2.  `:ro` (Read-Only) 옵션 때문에 다운로드가 실패하고 무한 루프에 빠지는지?
        *   **테스트**: `:ro`를 제거하고 실행해 봅니다. (쓰기 권한 부여)

### 4. 컨테이너 내부 경로 직접 확인
실행 중인 컨테이너에 접속하여 경로 구조를 직접 봅니다.

```bash
# 컨테이너 접속
docker exec -it <container_id> /bin/bash

# 경로 확인
ls -R /rvc-code/assets
```
*   호스트의 파일들이 보이지 않는다면 마운트 실패입니다.
*   파일은 보이는데 다운로드한다면 권한 문제일 가능성이 큽니다.

### 5. 임시 해결책 (강제 로컬 복사)
호스트 경로 마운트가 계속 문제를 일으킨다면, `Dockerfile`에서 빌드 시점에 아예 복사해버리는 방법이 있습니다. (단, 이미지 크기 증가)

```dockerfile
# apps/server-ai/Dockerfile
COPY --from=host path/to/assets /rvc-code/assets
```
(이 방법은 Context 용량 문제로 권장하지 않으며 최후의 수단입니다.)
