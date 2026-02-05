# Tailscale 하이브리드 아키텍처 설정 가이드

이 문서는 EC2(메인 서버)와 로컬 데스크탑(AI GPU 서버)을 **Tailscale VPN**으로 연결하여 하이브리드 아키텍처를 구축하는 방법을 설명합니다.

## 1. 아키텍처 개요

*   **EC2 (AWS)**: 웹 클라이언트, 시그널링 서버, 미디어 서버 실행
*   **로컬 데스크탑**: 고성능 GPU를 사용하여 AI 음성 변환 서버 실행
*   **Tailscale**: 두 환경을 안전한 사설 네트워크(VPN)로 연결

## 2. Tailscale 설치 및 설정

### 2.1 로컬 데스크탑 (AI 서버용)

1.  **Tailscale 설치**:
    *   **Linux**: `curl -fsSL https://tailscale.com/install.sh | sh`
    *   **Windows/Mac**: [Tailscale 다운로드 페이지](https://tailscale.com/download)에서 설치
2.  **로그인 및 기기 등록**:
    ```bash
    sudo tailscale up
    ```
    출력되는 URL을 브라우저에 입력하여 로그인합니다.
3.  **IP 확인**:
    ```bash
    tailscale ip -4
    # 예: 100.100.10.10
    ```
    이 IP(`100.x.x.x`)를 기억해두세요. EC2에서 이 주소로 접속합니다.

### 2.2 EC2 인스턴스 (메인 서버용)

**잠깐! 아직 EC2 설정을 하지 않으셨나요?**
제가 만들어둔 자동 설치 스크립트를 사용하면 Docker, Git, Tailscale을 한 번에 설치할 수 있습니다.

1.  **설치 스크립트 실행 (EC2 접속 후)**:
    ```bash
    # 스크립트 다운로드 및 실행
    curl -sSL https://raw.githubusercontent.com/Start-S14/S14P11B103/develop/scripts/setup_ec2.sh | bash
    
    # (주의: Private Repository라면 토큰이 필요할 수 있으니, 
    #  git clone https://github.com/Start-S14/S14P11B103.git 후 scripts/setup_ec2.sh 실행을 권장합니다)
    ```

2.  **수동 설치 (스크립트 미사용 시)**:
    *   **Docker**: `curl -fsSL https://get.docker.com | sh`
    *   **Tailscale**: `curl -fsSL https://tailscale.com/install.sh | sh`
    *   **Docker 권한 부여**: `sudo usermod -aG docker $USER` (후 재로그인 필수)

3.  **Tailscale 로그인**:
    ```bash
    sudo tailscale up
    ```
    출력되는 URL을 복사하여 로컬 브라우저에서 접속 후 로그인합니다.

4.  **연결 확인**:
    ```bash
    # 로컬 데스크탑의 Tailscale IP로 핑 테스트
    tailscale ping 100.x.x.x
    ```

## 3. 코드 배포 및 서버 실행

### 3.1 로컬 데스크탑 (AI 서버)

AI 서버는 로컬의 GPU 자원을 사용하므로 로컬에서 실행합니다.

```bash
# 프로젝트 루트 디렉토리에서 실행
docker compose -f docker-compose.ai-local.yml up -d --build
```

*   정상 실행 확인: `docker ps`로 `server-ai` 컨테이너가 떠 있는지 확인.

### 3.2 EC2 인스턴스 (메인 서버)

EC2에 코드를 가져오고 실행하는 과정입니다.

1.  **Repository Clone**:
    ```bash
    git clone https://github.com/Start-S14/S14P11B103.git
    cd S14P11B103
    ```

2.  **환경변수 설정 (`.env`)**:
    EC2의 `.env` 파일에 로컬 데스크탑의 Tailscale IP를 설정합니다.

    ```bash
    cp .env.example .env
    nano .env
    ```
    
    **.env 필수 수정 사항**:
    ```ini
    # 로컬 데스크탑의 Tailscale IP 입력 (예: 100.10.20.30)
    AI_SERVER_ADDR=100.x.x.x:50051  
    
    # EC2의 공인 IP (WebRTC 통신용)
    PION_NAT_1_1_HOST=<EC2_PUBLIC_IP>
    ```

3.  **서버 실행**:
    ```bash
    docker compose -f docker-compose.ec2.yml up -d --build
    ```

## 4. 트러블슈팅

*   **연결 실패 시**:
    *   양쪽 기기에서 `sudo tailscale status`로 연결 상태를 확인하세요.
    *   로컬 데스크탑의 방화벽이 50051 포트를 차단하는지 확인하세요 (Tailscale 인터페이스는 보통 허용됨).
*   **속도 저하**:
    *   `tailscale status` 명령어로 연결이 `direct`인지 `relay`인지 확인하세요. `direct`여야 빠릅니다.

---
**요약**: 로컬에서 `docker-compose.ai-local.yml` 실행 -> EC2에서 `AI_SERVER_ADDR` 설정 후 `docker-compose.ec2.yml` 실행.
