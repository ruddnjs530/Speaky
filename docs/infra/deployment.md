# 🚀 인프라 배포 가이드 (Infrastructure & Deployment)

이 문서는 프로덕션 환경(Production)에 서비스를 배포할 때 고려해야 할 사항과 **보안 강화** 방법을 설명합니다.

---

## 1. 배포 체크리스트 (Pre-flight Checklist)

배포 전에 반드시 아래 사항들을 확인하세요.

- [ ] **환경 변수 분리**: `.env.prod` 파일을 생성하고 시크릿(DB 비밀번호, API 키 등)을 관리합니다.
- [ ] **Docker 이미지 최적화**: `target: prod` 스테이지를 사용하여 불필요한 개발 도구를 제거합니다.
- [ ] **보안 강화 (Security)**: 루트 권한 제거 및 포트 접근 제한.

---

## 2. 보안 강화 (Security Hardening) 🔒

현재 개발 환경은 편의를 위해 Root 권한으로 실행되는 경우가 많습니다. 실제 서비스(Production)에서는 보안을 위해 다음과 같이 설정해야 합니다.

### 2.1. Non-root User 사용 (Dockerfile 수정 예시)

**AS-IS (현재)**: Root 권한으로 실행됨
**TO-BE (권장)**: 제한된 권한의 유저 생성 및 사용

```dockerfile
# apps/server-media/Dockerfile (Prod Stage 예시)

FROM alpine:latest AS prod

# 1. 보안 유저 생성
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /home/appuser/app

# 2. 파일 복사 및 권한 부여
COPY --from=builder --chown=appuser:appgroup /app/bin/server .

# 3. 유저 변경
USER appuser

CMD ["./server"]
```

### 2.2. 포트 바인딩 제한

`docker-compose.yml`에서 포트를 열 때, 호스트의 특정 인터페이스에만 바인딩하는 것이 좋습니다.

```yaml
ports:
  - "127.0.0.1:8080:8080" # 외부에서 직접 접속 차단 (Reverse Proxy 사용 시)
  # 또는
  - "8080:8080" # 외부 접속 허용
```

---

## 3. 프로덕션 실행 (Running via Docker Compose)

프로덕션 환경에서는 `docker-compose.prod.yml`을 따로 만들거나, 기존 파일에서 `target`을 `prod`로 오버라이딩 해야 합니다.

**실행 명령어:**
```bash
# 프로덕션 빌드 및 실행
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**docker-compose.prod.yml 예시:**
```yaml
services:
  server-media:
    build:
      target: prod # 프로덕션 스테이지 사용
    environment:
      - LOG_LEVEL=info
    restart: always # 서버 다운 시 자동 재시작

  client:
    build:
      target: prod
    ports:
      - "80:80" # 프로덕션은 80 포트 사용
```

---

## 4. 확장성 (Scalability)

트래픽이 늘어날 경우를 대비한 가이드입니다.

- **Nginx (Reverse Proxy)**: `client` 앞단에 Nginx를 두어 SSL 인증서(HTTPS) 처리와 캐싱을 담당하게 합니다.
- **DB 분리**: 현재는 고려되지 않았지만, DB는 컨테이너가 아닌 관리형 서비스(AWS RDS 등)를 사용하는 것을 권장합니다.

---

## 5. CI/CD 파이프라인 제안

GitHub Actions 등을 사용할 때의 흐름입니다.

1. **Commit**: 코드가 `main` 브랜치에 푸시됨.
2. **Build**: `Dockerfile`의 `test` 또는 `builder` 스테이지에서 유닛 테스트 실행.
   - `make proto` 명령어로 프로토파일 생성 필수.
3. **Image Push**: 테스트 통과 시 `target: prod` 이미지를 빌드하여 Docker Registry(ECR, Docker Hub)에 푸시.
4. **Deploy**: 운영 서버에서 `docker-compose up -d`로 새 이미지 배포.
