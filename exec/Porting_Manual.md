# 포팅 매뉴얼 (Porting Manual)

본 문서는 **Speaky 프로젝트**의 빌드, 배포 환경 구성 및 실행 방법을 설명합니다.

---

## 1. 프로젝트 사용 도구 및 버전 정보

| 구분 | 항목 | 버전 / 상세 정보 | 비고 |
|---|---|---|---|
| **OS** | Ubuntu (EC2) | 22.04 LTS (Jammy) | AWS |
| **Backend (Signaling)** | Java (JVM) | Temurin OpenJDK 21 | Spring Boot 4.0.1 |
| **Backend (Media)** | Go (Golang) | 1.25.5 | Pion WebRTC |
| **Frontend** | Node.js | 22-alpine | React, Vite |
| **Web Server** | Nginx | 1.25-alpine | Frontend Server |
| **AI Server** | Python | 3.10+ | Local GPU (RTX 4070) |
| **DB** | H2 Database | In-Memory (Embedded) | 개발/시연용 |
| **IDE** | IntelliJ / VSCode | Latest | |

---

## 2. 빌드 및 배포 가이드

### 2.1. 환경 변수 설정

배포 시 `docker-compose.ec2.yml` 파일 내에 정의된 환경 변수를 수정하여 사용합니다.

#### **Client (Frontend)**
| 변수명 | 설정값 예시 | 설명 |
|---|---|---|
| `VITE_API_URL` | `http://{EC2_PUBLIC_IP}:8080` | 시그널링 서버 API 주소 |
| `VITE_WS_URL` | `ws://{EC2_PUBLIC_IP}:8080/ws/signaling` | WebSocket 연결 주소 |

#### **Server-Media (Go)**
| 변수명 | 설정값 예시 | 설명 |
|---|---|---|
| `PORT` | `8090` | 미디어 서버 HTTP 포트 |
| `AI_SERVER_ADDR` | `{Tailscale_IP}:50051` | 로컬 AI 서버(GPU) 주소 (Tailscale VPN IP) |
| `PION_NAT_1_1_HOST` | `{EC2_PUBLIC_IP}` | WebRTC 연결을 위한 공인 IP (ICE Candidate) |
| `WEBRTC_MAX_PORT` | `50010` | WebRTC UDP 포트 범위 끝 (50000~50010) |
| `AI_BUFFER_DURATION` | `1600` | AI 음성 버퍼링 시간 (ms) |

#### **Server-SC (Signaling)**
| 변수명 | 설정값 예시 | 설명 |
|---|---|---|
| `MEDIA_SERVER_HOST` | `server-media` | Docker Network 내부 호스트명 |
| `MEDIA_SERVER_PORT` | `8090` | 미디어 서버 포트 |
| `VITE_WS_URL` | `ws://{EC2_PUBLIC_IP}:8080/ws/signaling` | 세션 정보 반환용 |

### 2.2. 배포 절차 (EC2 기준)

1. **소스 코드 클론**
   ```bash
   git clone https://lab.ssafy.com/s14-webmobile1-sub1/S14P11B103.git
   cd S14P11B103
   ```

2. **환경 변수 수정**
   *   `docker-compose.ec2.yml` 파일을 열어 `PION_NAT_1_1_HOST`를 현재 EC2의 공인 IP로 변경합니다.
   *   `AI_SERVER_ADDR`를 Tailscale IP로 변경합니다 (AI 서버가 로컬에 있는 경우).

3. **빌드 및 실행**
   
   **방법 1: Make 명령어 사용 (간편 실행)**
   ```bash
   # 프로젝트 루트 경로에서 실행
   make demo
   ```
   
   **방법 2: Docker Compose 직접 실행 (상세 설정 필요 시)**
   ```bash
   # 최신 코드 반영 및 Docker 이미지 빌드/실행
   # force-recreate 옵션으로 클린 배포 권장
   docker compose -f docker-compose.ec2.yml up -d --build --force-recreate
   ```

4. **실행 확인**
   ```bash
   docker ps
   # s14p11b103-client, s14p11b103-server-sc, s14p11b103-server-media 컨테이너가 Up 상태여야 함
   ```

---

## 3. 외부 서비스 정보

본 프로젝트는 외부 클라우드 서비스(AWS S3, Firebase 등)를 사용하지 않으며, **자체 호스팅** 방식으로 구성되어 있습니다.
단, 로컬 GPU 서버와의 통신을 위해 **Tailscale VPN**을 사용합니다.

| 서비스명 | 용도 | 비고 |
|---|---|---|
| **Tailscale** | EC2(클라우드) <-> Local(GPU) 간 보안 터널링 | VPN 네트워크 구성 필수 |

---

## 4. 데이터베이스 (DB) 덤프 파일

본 프로젝트는 시연 및 개발 편의성을 위해 **H2 In-Memory Database**를 사용합니다.
서버 실행 시 **`DataLoader.java`** 가 자동으로 실행되어 초기 데이터를 적재하므로, 별도의 SQL 덤프 파일을 임포트할 필요가 없습니다.
추후 MySQL/MariaDB로 변경 시에는 `application.properties` 파일의 DB 설정을 변경하고, H2 관련 코드를 제거해야 합니다.

*   **초기 데이터 생성 위치**: `apps/server-sc/src/main/java/org/speaky/serversc/config/DataLoader.java`
*   **기본 계정 정보**:
    *   **호스트(Streamer)**: ID `streamer123` / PW `password123`
    *   **관리자(Admin)**: ID `admin_user` / PW `admin123`

---

## 5. 시연 시나리오

### 5.1. 사전 준비
1.  **AI Voice Server 실행**: 로컬 GPU 머신에서 AI Voice 서버(`apps/server-ai`)를 실행하고 Tailscale로 연결 상태 확인.
2.  **EC2 서버 배포**: 위 배포 절차에 따라 EC2 서버 실행 완료.

### 5.2. 호스트(스트리머) 방송 시작
1.  브라우저(Chrome 권장)로 서비스 접속 (`http://{EC2_PUBLIC_IP}:5173`)
2.  **로그인**: ID `streamer123` / PW `password123` 입력.
3.  메인 페이지에서 **"방송 시작하기"** (또는 **"방 만들기"**) 버튼 클릭.
4.  방송 설정 화면 진입:
    *   카메라/마이크 권한 허용.
    *   **AI 보이스 모델 선택**: (예: "Korone", "Trump" 등) 원하는 목소리 선택.
5.  **"방송 시작"** 버튼 클릭 -> 방송 송출 시작 및 미리보기 화면 출력 확인.

### 5.3. 시청자 참여 (다른 브라우저)
1.  시크릿 탭 또는 다른 브라우저 실행.
2.  서비스 접속 (로그인 불필요, 또는 게스트 모드).
3.  메인 페이지의 **"방송 목록"** 에서 현재 송출 중인 방 클릭.
4.  방송 입장:
    *   호스트의 변조된 음성(AI Voice)과 화면이 정상적으로 수신되는지 확인.
    *   채팅 입력 및 반응(좋아요 등) 테스트.

### 5.4. 방송 종료
1.  호스트 화면에서 **"방송 종료"** 버튼 클릭.
2.  방송 종료 메시지 확인 및 메인 페이지 이동.
