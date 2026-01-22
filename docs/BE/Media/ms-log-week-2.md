# Media Server Sprint Week 2 - 상세 실행 계획 (Action Plan)

## 목표
Control Plane(제어부) 및 Media Ingestion(트랙 분리)을 안정적으로 구현하고 통합 테스트까지 5일간 진행합니다.

---

## Day 1: Control Plane Foundation (기초 공사)
**핵심 목표**: 여러 사용자가 동시에 방을 생성하거나 접속해도 서버의 동시성 문제가 발생하지 않도록 Thread-safe한 구조를 구축합니다.

### 1. Proto 파일 정의 (packages/proto/control.proto)
- [ ] `CreateRoomRequest` (HostID 등 필드 포함), `CreateRoomResponse` (RoomID, Token 필드 포함) 정의
- [ ] `JoinRoomRequest` (RoomID, SDP Offer 필드 포함), `JoinRoomResponse` (SDP Answer 필드 포함) 정의
- [ ] `make proto` 명령어를 실행하여 Go 및 Python용 gRPC 코드 생성 확인

### 2. Room 구조체 설계 (internal/media/room.go)
- [ ] `Room` 구조체 정의 (PeerConnection, Track 리스트, Mutex 포함)
- [ ] `context.Context`와 `context.CancelFunc`를 포함시켜 방 종료 시 자원 회수 메커니즘 마련

### 3. Room Manager 구현 (internal/media/manager.go)
- [ ] `map[string]*Room` 타입의 인메모리 저장소 생성
- [ ] **[중요]** `sync.RWMutex`를 사용하여 동시성 제어 로직 추가
- [ ] `GetRoom(id)`, `CreateRoom()`, `DeleteRoom(id)` 메서드 구현
- [ ] `DeleteRoom` 호출 시 내부 PeerConnection의 Close 메서드가 호출되도록 구현

---

## Day 2: Control Plane Service Logic (신호 체계 구현)
**핵심 목표**: 클라이언트와 서버가 SDP(Session Description Protocol)를 교환하여 연결 규격을 합의합니다.

### 1. gRPC Server 초기화 (cmd/server/main.go)
- [ ] `ControlService` 등록 및 gRPC 서버 구동 로직 작성

### 2. CreateRoom 핸들러 구현
- [ ] UUID 라이브러리를 사용하여 고유한 `RoomID` 생성
- [ ] Room Manager에 신규 방 등록 후 생성된 ID 반환

### 3. JoinRoom 핸들러 구현 (핵심 기능)
- [ ] Pion `webrtc.NewPeerConnection` 생성 (STUN 서버 설정: `stun:stun.l.google.com:19302`)
- [ ] 클라이언트로부터 수신한 `SDP Offer` 문자열을 `SetRemoteDescription`에 적용
- [ ] `CreateAnswer` 및 `SetLocalDescription` 수행
- [ ] **[필수]** ICE Gathering이 완료될 때까지 대기 (Vanilla ICE 방식) 후 최종 SDP 반환

### 4. 로컬 테스트
- [ ] `grpcurl` 도구를 사용하여 `CreateRoom` 호출 시 RoomID가 정상적으로 반환되는지 확인

---

## Day 3: Media Ingestion (트랙 분류 및 처리)
**핵심 목표**: 수신되는 패킷의 타입을 분석하여 오디오와 비디오를 각각 다른 처리 파이프라인으로 분기합니다.

### 1. OnTrack 콜백 작성 (internal/webrtc/receiver.go)
- [ ] `peerConnection.OnTrack` 핸들러 등록

### 2. MimeType 분기 로직 구현
- [ ] `remoteTrack.Codec().MimeType` 값을 확인하여 분기 처리
- [ ] `audio/opus`인 경우: 기존 Audio Pipeline으로 연결
- [ ] `video/vp8` (또는 H264)인 경우: Video 처리 로직으로 연결

### 3. Audio 파이프라인 연결
- [ ] 1주차에 구현한 `track.NewRegularTrack()` 호출
- [ ] 고루틴(Go Routine)으로 `ReadRTP()` 루프가 실행되는지 확인

### 4. Video 파이프라인 기초 작업
- [ ] `VideoTrack` 구조체 정의 (기본 형태)
- [ ] 별도의 고루틴에서 `ReadRTP()` 루프를 실행하며 "Video Packet Received" 로그가 출력되는지 확인

---

## Day 4: Video Processing Prep & Reliability (신뢰성 확보)
**핵심 목표**: 비디오 패킷 손실 시 화면 깨짐을 방지하기 위해 키프레임 요청(PLI) 메커니즘을 구현합니다.

### 1. PLI 요청 헬퍼 함수 구현
- [ ] `[]rtcp.Packet{&rtcp.PictureLossIndication{MediaSSRC: ...}}` 패킷 생성 로직 작성
- [ ] `peerConnection.WriteRTCP()`를 통해 전송하는 함수 구현

### 2. Keyframe 요청 로직 추가
- [ ] Video Track 수신 루프 시작 직후 PLI를 1회 전송하여 초기 화면 지연 방지
- [ ] (선택 사항) `time.NewTicker(3 * time.Second)` 등을 사용하여 주기적으로 PLI를 전송하도록 설정

### 3. 패킷 로깅 고도화
- [ ] 수신된 Video RTP 패킷의 `SequenceNumber`, `Timestamp` 로그 출력
- [ ] 로그를 통해 패킷이 끊김 없이 수신되는지 육안 확인

---

## Day 5: Integration Testing (통합 테스트)
**핵심 목표**: React 클라이언트와 서버를 연동하여 실제 미디어 데이터가 정상적으로 흐르는지 확인합니다.

### 1. Client (React) 수정
- [ ] 버튼 클릭 시 `getUserMedia` 호출 로직 추가
- [ ] `CreateRoom` 및 `JoinRoom` gRPC를 호출하여 SDP 교환 수행

### 2. End-to-End 테스트 수행
- [ ] Client: 카메라 및 마이크 활성화 확인
- [ ] Server Log 확인 순서: "Room Created" -> "SDP Exchanged" -> "Track Found (Audio)" -> "Track Found (Video)"

### 3. 리소스 정리 확인
- [ ] 브라우저 탭을 닫아 연결을 끊었을 때, 서버에서 `OnConnectionStateChange` -> `Failed/Closed` 상태 감지 확인
- [ ] `DeleteRoom` 로직이 실행되며 실행 중이던 고루틴들이 정상적으로 종료되는지 로그 확인

---

### 참고 사항 (Tips)
* Day 3 단계에서 Video Track이 수신되지 않을 경우, 대부분 SDP 코덱 불일치가 원인입니다. React Client가 전송하는 코덱(예: VP8)과 서버(Pion)가 수신 대기 중인 코덱 설정이 일치하는지 반드시 확인해야 합니다.