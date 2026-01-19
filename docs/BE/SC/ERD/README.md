## **전체 테이블 설명**

**1. users - 사용자 테이블**

역할: 시스템 사용자 정보 관리

필드:

- user_id: 사용자 고유 ID (PK)
- email: 이메일 (로그인용)
- password_hash: 암호화된 비밀번호
- nickname: 닉네임
- role: 역할 (HOST: 방송 호스트, ADMIN: 관리자)
- status: 계정 상태 (ACTIVE, BLOCKED, DELETED)
- created_at, updated_at: 생성/수정 시간

용도:

- 로그인 인증 (BE-MVP-001, BE-MVP-002)
- 사용자 정보 관리

---

**2. channels - 채널 테이블**

역할: 고정 URL 채널 정보 (영구적)

필드:

- user_id: 채널 소유자 ID (PK, FK → users.user_id) - 1:1 관계
- channel_key: 채널 고유 키 (예: "user1-channel") - URL에 사용 (/stream/{channel_key})
- title: 채널 제목
- description: 채널 설명
- visibility: 공개 범위 (PUBLIC, UNLISTED, PRIVATE)
- created_at, updated_at: 생성/수정 시간

용도:

- 고정 URL 채널 관리 (FE-MVP-006)
- 채널 메타데이터 저장
- 채널은 영구적으로 존재

---

**3. stream_sessions - 스트리밍 세션 테이블**

역할: 방송 세션 정보 관리 (임시적)

필드:

- session_id: 세션 고유 ID (PK)
- owner_user_id: 방송 소유자 ID (FK → users.user_id)
- status: 방송 상태 (STARTING, LIVE, ENDED, FAILED) - BE-MVP-005
- started_at, ended_at: 방송 시작/종료 시간
- stop_reason: 종료 사유
- media_server_id: Media Server 인스턴스 ID (방송 중일 때만 값 있음)
- pipeline_id: Media Server 파이프라인 ID (WebRTC 연결) - 방송 중일 때만 값 있음
- viewer_peak: 최대 시청자 수
- viewer_total: 총 시청자 수
- created_at: 세션 생성 시간

용도:

- 방송 세션 기록 (FE-MVP-005)
- 리소스 관리 (방송 중일 때만 media_server_id, pipeline_id 존재)
- 방송 통계 관리

---

**4. session_participants - 세션 참여자 테이블 (MVP에서 사용 안 함)**

역할: 방송 시청자(참여자) 기록

필드:

- participant_id: 참여 기록 ID (PK)
- session_id: 세션 ID (FK → stream_sessions.session_id)
- user_id: 참여자 사용자 ID (FK → users.user_id, NULL 허용 - 비로그인 게스트)
- role: 역할 (HOST: 호스트, MODERATOR: 관리자, VIEWER: 시청자)
- joined_at, left_at: 입장/퇴장 시간
- leave_reason: 퇴장 사유
- kicked: 강제 퇴장 여부

용도:

- 시청자 수 집계 (viewer_peak, viewer_total 계산)
- 참여자 기록 관리

---

**5. voice_models - 음성 모델 테이블**

역할: RVC 음성 변조 모델 정보 관리

필드:

- voice_model_id: 모델 ID (PK)
- name: 모델 이름
- description: 모델 설명
- storage_uri: 모델 파일 저장 경로 (AI Server에서 사용)
- sample_uri: 샘플 오디오 URL
- created_by_user_id: 모델 생성자 ID (FK → users.user_id)
- is_public: 공개 여부 (공개 모델/개인 모델)
- created_at: 생성 시간

용도:

- RVC 모델 정보 관리 (AI-MVP-002)
- 사용자별 보이스팩 관리
- AI Server에서 모델 파일 경로 참조

---

**6. stream_voice_configs - 스트리밍 음성 설정 테이블**

역할: 방송 세션별 RVC 음성 변조 설정

필드:

- config_id: 설정 ID (PK)
- session_id: 세션 ID (FK → stream_sessions.session_id) - UNIQUE (세션당 하나)
- voice_model_id: 사용할 음성 모델 ID (FK → voice_models.voice_model_id)
- rvc_enabled: RVC 사용 여부
- transpose: 피치 조절 값 (AI-MVP-001)
- index_rate, protect_rate, rms_mix_rate: RVC 모델 파라미터
- updated_at: 설정 업데이트 시간

용도:

- 방송 세션별 RVC 설정 저장
- AI Server에 전달할 변조 파라미터

---

**7. chat_messages - 채팅 메시지 테이블 (MVP에서 사용 안 함)**

역할: 채널/세션 채팅 메시지 저장

필드:

- message_id: 메시지 ID (PK)
- channel_user_id: 채널 소유자 ID (FK → channels.user_id)
- session_id: 세션 ID (FK → stream_sessions.session_id, NULL 허용 - 방송 중이 아니어도 채팅 가능)
- user_id: 메시지 작성자 ID (FK → users.user_id, NULL 허용 - 시스템 메시지)
- message_type: 메시지 타입 (TEXT: 일반, SYSTEM: 시스템)
- content: 메시지 내용
- created_at: 전송 시간

용도:

- 채널 채팅 저장
- 방송 중/대기 중 모두 채팅 가능
