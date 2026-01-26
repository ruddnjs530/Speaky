# Speaky - Jira Backlog (사용자 가치 중심)

> **구조 원칙**: Epic은 **사용자가 할 수 있는 기능**, Story는 **구체적인 사용자 행동**, Task는 **기술 구현**

---

## 📋 Epic 목록

### Epic 1: 실시간 스트리밍 방송 🎥
**가치**: Host가 화면과 음성을 실시간으로 방송하고, Viewer가 시청할 수 있다

#### Story 1.1: Host가 화면과 음성을 실시간으로 방송할 수 있다
**Acceptance Criteria**:
- [ ] Host가 화면 공유(탭/창/전체화면)를 선택할 수 있다
- [ ] Host가 마이크 입력을 선택할 수 있다
- [ ] Host가 "방송 시작" 버튼을 클릭하면 스트리밍이 시작된다
- [ ] 방송 중 화면과 음성이 실시간으로 전송된다

**Technical Tasks**:
- **Frontend**:
  - Task 1.1.1: ✅ Screen Capture API 연동 (`getDisplayMedia`)
  - Task 1.1.2: ✅ 마이크 권한 요청 및 장치 선택 UI
  - Task 1.1.3: ✅ WebRTC PeerConnection 생성 및 트랙 추가
  - Task 1.1.4: ✅ 방송 시작/종료 버튼 및 상태 관리
- **Backend (Media Server)**:
  - Task 1.1.5: ✅ Pion WebRTC Receiver 구현
  - Task 1.1.6: ✅ Audio Track 수신 및 Opus 디코딩
  - Task 1.1.7: Video Track 수신 및 VP8/H.264 디코딩
  - Task 1.1.8: Room Manager 구현 (세션별 PeerConnection 관리)
- **Backend (SC Server)**:
  - Task 1.1.9: 세션 생성 API (`POST /api/sessions`)
  - Task 1.1.10: 세션 상태 관리 (IDLE → LIVE 전환)
  - Task 1.1.11: Media Server 연동 (CreateRoom gRPC)

---

#### Story 1.2: Viewer가 실시간 방송을 시청할 수 있다
**Acceptance Criteria**:
- [ ] Viewer가 방송 URL로 접속하면 시청 화면이 표시된다
- [ ] 방송 중이 아니면 "대기 중" 화면이 표시된다
- [ ] 방송이 시작되면 자동으로 스트림이 재생된다
- [ ] Viewer가 볼륨을 조절하고 음소거할 수 있다

**Technical Tasks**:
- **Frontend**:
  - Task 1.2.1: ✅ Room 상태 폴링 (`GET /api/sessions/{sid}/status`)
  - Task 1.2.2: ✅ 대기/시청 화면 분기 로직
  - Task 1.2.3: ✅ WebRTC PeerConnection 수신 설정
  - Task 1.2.4: ✅ 자동 재생 처리 (autoplay fallback)
  - Task 1.2.5: ✅ AudioControl 컴포넌트 (볼륨/음소거)
- **Backend (Media Server)**:
  - Task 1.2.6: SFU Broadcaster 구현 (1:N Fan-out)
  - Task 1.2.7: Guest 입장 시 Downstream Track 할당
  - Task 1.2.8: Zero-copy 최적화
- **Backend (SC Server)**:
  - Task 1.2.9: STOMP WebSocket 인프라 구축
  - Task 1.2.10: 시그널링 메시지 라우팅 (Offer/Answer/ICE)
  - Task 1.2.11: Session Registry 구현 (peerId → wsSessionId)

---

#### Story 1.3: 1:N 다중 시청자를 동시에 지원한다
**Acceptance Criteria**:
- [ ] 최소 50명의 Viewer가 동시 시청 가능
- [ ] 새 Viewer 입장 시 기존 시청자에게 영향 없음
- [ ] Viewer 퇴장 시 자동으로 연결 정리

**Technical Tasks**:
- **Backend (Media Server)**:
  - Task 1.3.1: SFU Fan-out 성능 최적화
  - Task 1.3.2: PeerConnection Pool 관리
  - Task 1.3.3: 부하 테스트 (1:50 동시 접속)
- **Backend (SC Server)**:
  - Task 1.3.4: Guest Presence 관리 (JOIN/LEAVE/HEARTBEAT)
  - Task 1.3.5: Redis 기반 동접자 추적
  - Task 1.3.6: TTL 기반 유령 연결 정리 스케줄러

---

#### Story 1.4: Host가 방송 전 사전 점검을 할 수 있다
**Acceptance Criteria**:
- [ ] 마이크 권한 상태를 확인할 수 있다
- [ ] 마이크 입력 레벨을 시각적으로 확인할 수 있다
- [ ] AI 서버 상태를 확인할 수 있다
- [ ] 모든 점검 완료 후 방송 시작 가능

**Technical Tasks**:
- **Frontend**:
  - Task 1.4.1: ✅ Pre-check 페이지 UI
  - Task 1.4.2: ✅ 마이크 권한 요청 및 상태 표시
  - Task 1.4.3: ✅ 입력 레벨 시각화 (AudioContext)
  - Task 1.4.4: ✅ 헬스 체크 배지 UI
- **Backend (AI Server)**:
  - Task 1.4.5: ✅ GetStatus RPC 구현
  - Task 1.4.6: 모델 로딩 상태 반영 (LOADING/READY/ERROR)

---

### Epic 2: AI 음성 변조 🎙️
**가치**: Host가 자신의 목소리를 AI로 변조하여 익명성과 재미를 제공한다

#### Story 2.1: Host가 자신의 목소리를 AI로 변조하여 방송할 수 있다
**Acceptance Criteria**:
- [ ] Host가 방송 시작 시 음성 변조가 자동 적용된다
- [ ] 변조된 음성이 Viewer에게 실시간으로 전달된다
- [ ] 음성 변조 레이턴시가 300ms 이하이다
- [ ] 음성과 화면의 싱크가 맞는다 (오차 < 200ms)

**Technical Tasks**:
- **Backend (AI Server)**:
  - Task 2.1.1: RVC 모델 선정 및 다운로드
  - Task 2.1.2: RVCConverter 클래스 구현
  - Task 2.1.3: ConvertStream RPC에 RVC 변환 로직 통합
  - Task 2.1.4: GPU 추론 최적화 (CUDA/TensorRT)
  - Task 2.1.5: 배치 처리 최적화 (청크 크기 조정)
- **Backend (Media Server)**:
  - Task 2.1.6: ✅ Audio 파이프라인 (Opus → PCM → Resampling)
  - Task 2.1.7: ✅ gRPC 스트리밍 연동 (AI 서버)
  - Task 2.1.8: A/V 동기화 - 레이턴시 측정
  - Task 2.1.9: A/V 동기화 - Video Delay Queue 구현
  - Task 2.1.10: A/V 동기화 - Timestamp 기반 정렬

---

#### Story 2.2: Host가 여러 보이스팩 중 선택할 수 있다
**Acceptance Criteria**:
- [ ] 최소 3종의 보이스팩이 제공된다
- [ ] Host가 방송 전 보이스팩을 선택할 수 있다
- [ ] 보이스팩 변경 시 즉시 적용된다

**Technical Tasks**:
- **Backend (AI Server)**:
  - Task 2.2.1: 다중 RVC 모델 로딩 지원
  - Task 2.2.2: 모델 전환 API (`POST /api/voice/models`)
  - Task 2.2.3: 모델별 상태 관리 (메모리 최적화)
- **Frontend**:
  - Task 2.2.4: 보이스팩 선택 UI (드롭다운/카드)
  - Task 2.2.5: 보이스팩 미리듣기 기능
  - Task 2.2.6: 선택한 보이스팩 저장 (localStorage)

---

#### Story 2.3: Host가 음성 피치를 조절할 수 있다
**Acceptance Criteria**:
- [ ] 피치 조절 슬라이더가 제공된다 (-12 ~ +12 반음)
- [ ] 피치 변경 시 실시간으로 적용된다
- [ ] 피치 조절이 음질에 영향을 주지 않는다

**Technical Tasks**:
- **Backend (AI Server)**:
  - Task 2.3.1: RVC 피치 파라미터 추가
  - Task 2.3.2: 피치 조절 API (`PATCH /api/voice/pitch`)
- **Frontend**:
  - Task 2.3.3: 피치 조절 슬라이더 UI
  - Task 2.3.4: 실시간 피치 변경 요청

---

### Epic 3: 아바타 방송 👾
**가치**: Host가 Live2D 아바타로 방송하여 시각적 재미와 익명성을 제공한다

#### Story 3.1: Host가 Live2D 아바타로 방송할 수 있다
**Acceptance Criteria**:
- [ ] 기본 제공 아바타가 1종 이상 있다
- [ ] Host가 아바타를 선택하면 화면에 표시된다
- [ ] 아바타가 부드럽게 애니메이션된다 (30fps 이상)

**Technical Tasks**:
- **Frontend**:
  - Task 3.1.1: Live2D SDK 연동
  - Task 3.1.2: 아바타 렌더링 컴포넌트 (Canvas)
  - Task 3.1.3: 기본 아바타 에셋 추가
  - Task 3.1.4: 아바타 선택 UI
  - Task 3.1.5: Canvas 성능 최적화

---

#### Story 3.2: 아바타가 음성에 맞춰 립싱크한다
**Acceptance Criteria**:
- [ ] Host가 말할 때 아바타 입이 움직인다
- [ ] 음성 크기에 따라 입 벌림 정도가 달라진다
- [ ] 립싱크 지연이 100ms 이하이다

**Technical Tasks**:
- **Frontend**:
  - Task 3.2.1: AudioContext로 음성 레벨 분석
  - Task 3.2.2: Live2D 파라미터 매핑 (입 벌림)
  - Task 3.2.3: 립싱크 애니메이션 구현
  - Task 3.2.4: 지연 최소화 튜닝

---

#### Story 3.3: Host가 커스텀 Live2D 아바타를 업로드할 수 있다
**Acceptance Criteria**:
- [ ] Host가 .model3.json 파일을 업로드할 수 있다
- [ ] 업로드한 아바타가 목록에 추가된다
- [ ] 커스텀 아바타로 방송할 수 있다

**Technical Tasks**:
- **Frontend**:
  - Task 3.3.1: 파일 업로드 UI
  - Task 3.3.2: Live2D 모델 검증 로직
  - Task 3.3.3: 업로드된 모델 저장 (IndexedDB)
- **Backend (SC Server)**:
  - Task 3.3.4: 아바타 파일 업로드 API (`POST /api/avatars`)
  - Task 3.3.5: 파일 저장 (S3/MinIO)
  - Task 3.3.6: 아바타 메타데이터 관리

---

### Epic 4: 채널 및 접근 관리 📺
**가치**: Host가 자신의 채널을 관리하고, Viewer 접근을 제어할 수 있다

#### Story 4.1: Host가 자신의 채널을 생성하고 관리할 수 있다
**Acceptance Criteria**:
- [ ] Host가 채널명을 설정할 수 있다
- [ ] Host가 채널 설명을 작성할 수 있다
- [ ] Host가 채널 썸네일을 업로드할 수 있다
- [ ] 채널 URL이 자동 생성된다 (`/channel/{channelId}`)

**Technical Tasks**:
- **Backend (SC Server)**:
  - Task 4.1.1: Channel 엔티티 및 Repository
  - Task 4.1.2: 채널 생성 API (`POST /api/channels`)
  - Task 4.1.3: 채널 조회 API (`GET /api/channels/{channelId}`)
  - Task 4.1.4: 채널 수정 API (`PATCH /api/channels/{channelId}`)
  - Task 4.1.5: 썸네일 업로드 처리
- **Frontend**:
  - Task 4.1.6: 채널 생성 폼 UI
  - Task 4.1.7: 채널 설정 페이지
  - Task 4.1.8: 썸네일 업로드 컴포넌트

---

#### Story 4.2: Host가 방송 공개 범위를 설정할 수 있다
**Acceptance Criteria**:
- [ ] 공개/비공개/비밀번호 보호 중 선택 가능
- [ ] 비밀번호 보호 시 Viewer가 비밀번호 입력 필요
- [ ] 비공개 시 초대받은 사용자만 접근 가능

**Technical Tasks**:
- **Backend (SC Server)**:
  - Task 4.2.1: 세션 접근 제어 필드 추가 (access_type, password)
  - Task 4.2.2: 비밀번호 검증 API (`POST /api/sessions/{sid}/verify`)
  - Task 4.2.3: 허용 ID 리스트 관리 (allowed_users)
  - Task 4.2.4: 입장 권한 검증 미들웨어
- **Frontend**:
  - Task 4.2.5: 공개 범위 선택 UI (라디오 버튼)
  - Task 4.2.6: 비밀번호 입력 모달
  - Task 4.2.7: 초대 ID 관리 UI

---

#### Story 4.3: Viewer가 공개 방송 목록을 조회할 수 있다
**Acceptance Criteria**:
- [ ] 현재 LIVE 중인 방송 목록이 표시된다
- [ ] 각 방송의 썸네일, 제목, 시청자 수가 표시된다
- [ ] 방송 카드를 클릭하면 시청 화면으로 이동한다
- [ ] 페이지네이션이 지원된다 (20개씩)

**Technical Tasks**:
- **Backend (SC Server)**:
  - Task 4.3.1: 공개 스트림 목록 API (`GET /api/streams?status=live`)
  - Task 4.3.2: 페이지네이션 및 정렬 (시청자 수 내림차순)
  - Task 4.3.3: 동접자 수 집계 (Redis)
- **Frontend**:
  - Task 4.3.4: 스트림 목록 페이지
  - Task 4.3.5: 스트림 카드 컴포넌트
  - Task 4.3.6: 페이지네이션 UI
  - Task 4.3.7: 검색 및 필터링 (선택)

---

### Epic 5: 실시간 소통 💬
**가치**: Host와 Viewer가 채팅과 이모지로 실시간 소통할 수 있다

#### Story 5.1: Viewer가 실시간 채팅을 할 수 있다
**Acceptance Criteria**:
- [ ] Viewer가 채팅 메시지를 입력하고 전송할 수 있다
- [ ] 모든 Viewer에게 실시간으로 메시지가 표시된다
- [ ] 메시지에 닉네임과 타임스탬프가 표시된다
- [ ] 채팅 히스토리가 스크롤 가능하다

**Technical Tasks**:
- **Backend (SC Server)**:
  - Task 5.1.1: 채팅 메시지 STOMP 토픽 (`/pub/session/{sid}/chat`)
  - Task 5.1.2: 채팅 브로드캐스트 (`/sub/session/{sid}/chat`)
  - Task 5.1.3: 메시지 검증 (길이 제한, 욕설 필터)
  - Task 5.1.4: 채팅 히스토리 저장 (Redis, 최근 100개)
- **Frontend**:
  - Task 5.1.5: ChatPanel 컴포넌트
  - Task 5.1.6: 메시지 입력 폼
  - Task 5.1.7: 메시지 리스트 (자동 스크롤)
  - Task 5.1.8: STOMP 채팅 메시지 송수신

---

#### Story 5.2: Viewer가 이모지 반응을 보낼 수 있다
**Acceptance Criteria**:
- [ ] 이모지 버튼(👍❤️😂🎉 등)이 제공된다
- [ ] Viewer가 이모지를 클릭하면 화면에 애니메이션 표시
- [ ] 모든 Viewer에게 이모지 애니메이션이 동기화된다
- [ ] 이모지가 3초 후 자동 사라진다

**Technical Tasks**:
- **Backend (SC Server)**:
  - Task 5.2.1: 이모지 메시지 STOMP 토픽 (`/pub/session/{sid}/emoji`)
  - Task 5.2.2: 이모지 브로드캐스트
- **Frontend**:
  - Task 5.2.3: 이모지 버튼 UI
  - Task 5.2.4: 이모지 애니메이션 오버레이
  - Task 5.2.5: CSS 애니메이션 (떠오르기 효과)

---

### Epic 6: 사용자 인증 및 프로필 🔐
**가치**: Host가 계정을 관리하고, Guest가 간편하게 접근할 수 있다

#### Story 6.1: Host가 ID/비밀번호로 로그인할 수 있다
**Acceptance Criteria**:
- [ ] 로그인 폼에서 ID/비밀번호 입력 가능
- [ ] 로그인 성공 시 JWT 토큰 발급
- [ ] 토큰이 자동으로 저장되고 갱신된다
- [ ] 로그인 실패 시 에러 메시지 표시

**Technical Tasks**:
- **Backend (SC Server)**:
  - Task 6.1.1: Spring Security + JWT 설정
  - Task 6.1.2: User 엔티티 및 Repository
  - Task 6.1.3: AuthService 구현 (토큰 발급/검증)
  - Task 6.1.4: 로그인 API (`POST /api/auth/login`)
  - Task 6.1.5: 토큰 갱신 API (`POST /api/auth/refresh`)
- **Frontend**:
  - Task 6.1.6: ✅ 로그인 페이지 UI
  - Task 6.1.7: AuthContext 및 useAuth 훅
  - Task 6.1.8: 토큰 저장 및 자동 갱신 로직
  - Task 6.1.9: ✅ ProtectedRoute 컴포넌트

---

#### Story 6.2: Guest가 별도 가입 없이 방송을 시청할 수 있다
**Acceptance Criteria**:
- [ ] Guest가 로그인 없이 시청 화면 접근 가능
- [ ] Guest에게 임시 ID(guestConnId)가 자동 발급된다
- [ ] Guest가 채팅 시 "Guest_12345" 형식으로 표시된다

**Technical Tasks**:
- **Backend (SC Server)**:
  - Task 6.2.1: AVT(Anonymous Viewer Token) 발급 로직
  - Task 6.2.2: AVT 검증 필터
  - Task 6.2.3: Guest 입장 API (`POST /api/auth/guest`)
  - Task 6.2.4: guestConnId 생성 로직 (UUID)
- **Frontend**:
  - Task 6.2.5: Guest 자동 토큰 발급 처리
  - Task 6.2.6: Guest 닉네임 표시 로직

---

#### Story 6.3: Host가 프로필을 설정할 수 있다
**Acceptance Criteria**:
- [ ] Host가 닉네임을 설정할 수 있다
- [ ] Host가 프로필 사진을 업로드할 수 있다
- [ ] 프로필 정보가 채널에 표시된다

**Technical Tasks**:
- **Backend (SC Server)**:
  - Task 6.3.1: User 프로필 필드 추가 (nickname, profile_image)
  - Task 6.3.2: 프로필 수정 API (`PATCH /api/users/me`)
  - Task 6.3.3: 프로필 이미지 업로드 처리
- **Frontend**:
  - Task 6.3.4: ✅ 프로필 페이지 UI
  - Task 6.3.5: 프로필 수정 폼
  - Task 6.3.6: 이미지 업로드 컴포넌트

---

### Epic 7: 플랫폼 인프라 및 운영 ⚙️
**가치**: 안정적인 서비스 운영과 모니터링

#### Story 7.1: 개발 환경을 Docker로 쉽게 구축할 수 있다
**Acceptance Criteria**:
- [ ] `docker-compose up` 한 번으로 전체 서비스 실행
- [ ] 각 서비스의 헬스체크가 정상 동작
- [ ] Hot reload가 지원되어 코드 수정 시 자동 반영

**Technical Tasks**:
- **DevOps**:
  - Task 7.1.1: Multi-stage Dockerfile 최적화 (각 서비스)
  - Task 7.1.2: docker-compose.yml 개선
  - Task 7.1.3: 환경 변수 관리 (.env.example)
  - Task 7.1.4: 헬스체크 엔드포인트 추가
  - Task 7.1.5: 볼륨 마운트 설정 (Hot reload)

---

#### Story 7.2: CI/CD로 자동 배포할 수 있다
**Acceptance Criteria**:
- [ ] main 브랜치 푸시 시 자동 테스트 실행
- [ ] 테스트 통과 시 Docker 이미지 빌드
- [ ] Staging 환경에 자동 배포
- [ ] 배포 실패 시 Slack 알림

**Technical Tasks**:
- **DevOps**:
  - Task 7.2.1: GitHub Actions 워크플로우 작성
  - Task 7.2.2: 자동 테스트 실행 (lint, unit test)
  - Task 7.2.3: Docker 이미지 빌드 및 푸시 (Docker Hub/ECR)
  - Task 7.2.4: 배포 스크립트 작성
  - Task 7.2.5: Slack 알림 연동

---

#### Story 7.3: 실시간 모니터링으로 시스템 상태를 확인할 수 있다
**Acceptance Criteria**:
- [ ] Grafana 대시보드에서 주요 메트릭 확인 가능
- [ ] CPU/메모리/네트워크 사용량 모니터링
- [ ] 동접자 수, 레이턴시 실시간 확인
- [ ] 임계치 초과 시 알림 발송

**Technical Tasks**:
- **DevOps**:
  - Task 7.3.1: Prometheus 설정
  - Task 7.3.2: Grafana 대시보드 구성
  - Task 7.3.3: 메트릭 수집 (각 서비스)
  - Task 7.3.4: 알림 규칙 설정 (AlertManager)
  - Task 7.3.5: 중앙 로깅 (ELK Stack, 선택)

---

## 📅 스프린트 계획 (MVP 우선)

### 🏁 Sprint 1: 기본 스트리밍 (2주)
**목표**: Host가 방송하고 Viewer가 시청할 수 있는 MVP

#### 포함 Story
- ✅ **Epic 1 - Story 1.1**: Host가 화면과 음성을 실시간으로 방송할 수 있다 (80% 완료)
- ✅ **Epic 1 - Story 1.2**: Viewer가 실시간 방송을 시청할 수 있다 (70% 완료)
- **Epic 1 - Story 1.3**: 1:N 다중 시청자를 동시에 지원한다
- **Epic 6 - Story 6.1**: Host가 ID/비밀번호로 로그인할 수 있다

#### 완료 조건
- [ ] Host가 화면 공유 + 마이크로 방송 시작
- [ ] 최소 5명의 Viewer가 동시 시청 가능
- [ ] A/V 싱크 오차 < 500ms (AI 변조 전)
- [ ] 로그인/로그아웃 정상 동작

---

### 🎨 Sprint 2: AI 음성 변조 (2주)
**목표**: RVC 기반 실시간 음성 변환 적용

#### 포함 Story
- **Epic 2 - Story 2.1**: Host가 자신의 목소리를 AI로 변조하여 방송할 수 있다
- **Epic 1 - Story 1.4**: Host가 방송 전 사전 점검을 할 수 있다
- **Epic 2 - Story 2.2**: Host가 여러 보이스팩 중 선택할 수 있다 (기본 1종)

#### 완료 조건
- [ ] AI 음성 변조 레이턴시 < 300ms
- [ ] A/V 싱크 오차 < 200ms
- [ ] 1시간 연속 스트리밍 안정성 테스트 통과
- [ ] Pre-check 화면에서 AI 서버 상태 확인 가능

---

### 👾 Sprint 3: 아바타 및 채널 관리 (2주)
**목표**: Live2D 아바타와 채널 기능 완성

#### 포함 Story
- **Epic 3 - Story 3.1**: Host가 Live2D 아바타로 방송할 수 있다
- **Epic 3 - Story 3.2**: 아바타가 음성에 맞춰 립싱크한다
- **Epic 4 - Story 4.1**: Host가 자신의 채널을 생성하고 관리할 수 있다
- **Epic 4 - Story 4.2**: Host가 방송 공개 범위를 설정할 수 있다

#### 완료 조건
- [ ] 기본 아바타 1종 제공 및 렌더링
- [ ] 립싱크 정확도 육안 확인
- [ ] 채널 생성/수정 정상 동작
- [ ] 비밀번호 보호 스트림 접근 제어

---

### 💬 Sprint 4: 소통 기능 및 UX (1.5주)
**목표**: 채팅, 이모지, 스트림 목록 완성

#### 포함 Story
- **Epic 5 - Story 5.1**: Viewer가 실시간 채팅을 할 수 있다
- **Epic 5 - Story 5.2**: Viewer가 이모지 반응을 보낼 수 있다
- **Epic 4 - Story 4.3**: Viewer가 공개 방송 목록을 조회할 수 있다
- **Epic 6 - Story 6.2**: Guest가 별도 가입 없이 방송을 시청할 수 있다

#### 완료 조건
- [ ] 채팅 메시지 실시간 송수신
- [ ] 이모지 애니메이션 정상 표시
- [ ] 공개 스트림 목록 조회 및 페이지네이션
- [ ] Guest 자동 입장 및 채팅 참여

---

### 🚀 Sprint 5: 프로덕션 준비 (1.5주)
**목표**: 배포, 모니터링, 성능 최적화

#### 포함 Story
- **Epic 7 - Story 7.1**: 개발 환경을 Docker로 쉽게 구축할 수 있다
- **Epic 7 - Story 7.2**: CI/CD로 자동 배포할 수 있다
- **Epic 7 - Story 7.3**: 실시간 모니터링으로 시스템 상태를 확인할 수 있다
- **Epic 2 - Story 2.3**: Host가 음성 피치를 조절할 수 있다
- **Epic 6 - Story 6.3**: Host가 프로필을 설정할 수 있다

#### 완료 조건
- [ ] 프로덕션 배포 성공 (Staging)
- [ ] 1:50 동시 접속 부하 테스트 통과
- [ ] Grafana 대시보드 정상 동작
- [ ] 보안 점검 완료 (OWASP Top 10)

---

## 🎯 백로그 우선순위 (MoSCoW)

### Must Have (MVP 필수)
- Epic 1: 실시간 스트리밍 방송
- Epic 2 - Story 2.1: AI 음성 변조 (기본)
- Epic 6 - Story 6.1, 6.2: 인증 (Host/Guest)

### Should Have (베타 출시 전)
- Epic 3: 아바타 방송
- Epic 4: 채널 및 접근 관리
- Epic 5: 실시간 소통

### Could Have (추가 기능)
- Epic 2 - Story 2.2, 2.3: 다중 보이스팩, 피치 조절
- Epic 3 - Story 3.3: 커스텀 아바타 업로드
- Epic 6 - Story 6.3: 프로필 설정

### Won't Have (현재 스코프 외)
- 소셜 로그인 (OAuth)
- 모바일 앱
- VOD 녹화/다시보기
- 슈퍼챗/후원 기능

---

## 📊 성공 지표 (KPI)

### 기술 지표
| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| AI 음성 변조 레이턴시 | < 300ms | Prometheus 메트릭 |
| 전체 E2E 레이턴시 | < 500ms | 클라이언트 측정 |
| A/V 싱크 오차 | < 200ms | 육안 + 자동 테스트 |
| 동시 접속 지원 | 1:50 | 부하 테스트 |
| 서비스 가용성 | 99% | Uptime 모니터링 |

### 사용자 지표
| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| 방송 시작 성공률 | > 95% | 로그 분석 |
| 평균 시청 시간 | > 10분 | Analytics |
| Guest 전환율 | > 30% | 회원가입 추적 |

---

## ⚠️ 리스크 관리

| 리스크 | 영향도 | 확률 | 대응 방안 |
|--------|--------|------|-----------|
| RVC 레이턴시 과다 | 높음 | 중간 | GPU 최적화, 모델 경량화, 배치 크기 조정 |
| WebRTC 연결 불안정 | 중간 | 중간 | TURN 서버 구축, ICE 재연결 로직 |
| 1:N 확장성 문제 | 중간 | 낮음 | SFU 최적화, 서버 스케일아웃 계획 |
| Live2D 성능 이슈 | 낮음 | 낮음 | Canvas 최적화, 프레임 제한 (30fps) |
| AI 서버 다운타임 | 높음 | 낮음 | Fallback 모드 (원본 음성), 헬스체크 강화 |

---

## 📝 Jira 설정 가이드

### 1. Epic 생성 순서
1. Epic 1: 실시간 스트리밍 방송 (최우선)
2. Epic 6: 사용자 인증 및 프로필
3. Epic 2: AI 음성 변조
4. Epic 3: 아바타 방송
5. Epic 4: 채널 및 접근 관리
6. Epic 5: 실시간 소통
7. Epic 7: 플랫폼 인프라 및 운영

### 2. Story 포인트 추정 (피보나치)
- **1점**: 단순 UI 컴포넌트, 설정 변경
- **2점**: CRUD API, 기본 폼
- **3점**: WebRTC 연결, STOMP 메시지 라우팅
- **5점**: AI 모델 통합, A/V 동기화
- **8점**: SFU 브로드캐스트, Live2D 통합
- **13점**: 전체 인증 시스템

### 3. 라벨 체계
- `frontend`, `backend-sc`, `backend-media`, `backend-ai`, `devops`
- `mvp`, `beta`, `nice-to-have`
- `bug`, `tech-debt`, `research`

### 4. Sprint 네이밍
- `Sprint 1 - 기본 스트리밍 (2026.01.20 ~ 2026.02.02)`
- `Sprint 2 - AI 음성 변조 (2026.02.03 ~ 2026.02.16)`

---

## 🚀 다음 단계

### 즉시 시작
1. **Jira 프로젝트 생성** (Scrum 템플릿)
2. **Epic 7개 등록** (위 순서대로)
3. **Sprint 1 Story 등록** (Epic 1, 6 중심)
4. **팀 역할 분담 회의**

### Sprint 1 착수 준비
**현재 완료 (Week 1)**:
- ✅ Frontend: 라우팅, 화면 공유, Viewer UI, Pre-check
- ✅ Media Server: Audio Pipeline, WebRTC Receiver
- ✅ AI Server: gRPC 인프라

**Sprint 1 집중 작업**:
1. SC Server 시그널링 구현 (STOMP + Session Registry)
2. Media Server SFU 구현 (Video Track + Fan-out)
3. 통합 테스트 (Host → Media → Viewers)
4. JWT 인증 기본 구현

### 팀 역할 분담 (제안)
- **Frontend 팀 (2명)**: Epic 1, 3, 5 UI 구현
- **Backend SC 팀 (2명)**: Epic 1, 4, 6 API 구현
- **Backend Media 팀 (1명)**: Epic 1 WebRTC/SFU
- **AI 팀 (1명)**: Epic 2 RVC 모델 통합
- **Full-stack (1명)**: Epic 7 DevOps + 통합 지원
