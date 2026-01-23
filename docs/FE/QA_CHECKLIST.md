# QA 체크리스트 (Day4)

본 문서는 WebRTC 시그널링(WS) + 세션 플로우에서 “재현 가능한” 장애/엣지케이스 시나리오를 정리합니다.  
디버깅은 Dev 모드 **DebugPanel(Signaling Trace)** 를 기준으로 관측합니다.

---

## 공통 관측 포인트

- DebugPanel에서 확인
    - `WS_OPEN / WS_CLOSE / WS_ERROR`
    - `SYS_ATTACH` 송신 여부(최초 1회)
    - `SIG_OFFER` ↔ `SIG_ANSWER` (requestId 상관관계)
    - `SIG_ICE` 수신/송신 흐름
    - `SYS_ERROR` code/msg

---

## 시나리오 목록

### 1) 토큰 만료 / 인증 실패
- 재현
    - 만료된 token으로 ws connect
- 기대 동작
    - 서버가 `SYS_ERROR(code=UNAUTHORIZED)` 또는 연결 종료
    - 클라이언트는 오류 화면/재로그인 유도
- 관측
    - `WS_OPEN` 직후 `SYS_ERROR` 또는 `WS_CLOSE`

### 2) WS Drop (네트워크 끊김)
- 재현
    - DevTools > Network offline / 또는 서버 강제 종료
- 기대 동작
    - `WS_CLOSE` 감지
    - (정책에 따라) 재연결 UI/안내 표시
- 관측
    - `WS_CLOSE code=1006` 등

### 3) autoplay 실패
- 재현
    - 사용자 제스처 없이 재생 유도(브라우저 정책)
- 기대 동작
    - UI에 “재생 버튼/클릭 안내” 노출
- 관측
    - 시그널링은 정상이어도, 미디어 재생 에러 발생(콘솔/UX)

### 4) ICE 선도착(Trickle ICE)
- 재현
    - 네트워크 환경에 따라 ICE가 Answer보다 빨리 도착 가능
- 기대 동작
    - RemoteDescription 전에 ICE가 오면 큐잉 후 처리 또는 안전하게 무시/재시도
- 관측
    - `SIG_ICE`가 `SIG_ANSWER`보다 먼저 들어오는지 확인

### 5) 세션 종료/비활성
- 재현
    - 방송 종료 후 Viewer가 늦게 join 또는 이미 종료된 sessionId로 attach/offer
- 기대 동작
    - `SYS_ERROR(code=SESSION_NOT_ACTIVE)`
- 관측
    - `SYS_ERROR` code 확인

### 6) INVALID_STATE (attach 전 offer)
- 재현
    - 클라이언트 버그로 attach 전에 offer 전송
- 기대 동작
    - `SYS_ERROR(code=INVALID_STATE)`
- 관측
    - `SIG_OFFER` 이전에 `SYS_ATTACH`가 반드시 있는지

### 7) Media Server 장애
- 재현
    - 미디어 서버 down / SC->Media 연결 실패
- 기대 동작
    - `SYS_ERROR(code=MEDIA_UNAVAILABLE)`
- 관측
    - offer 송신 후 answer 미수신 + sys_error 발생 여부

### 8) RATE_LIMITED / 남용 방지
- 재현
    - offer/ice 과도 전송
- 기대 동작
    - `SYS_ERROR(code=RATE_LIMITED)` 또는 서버 close
- 관측
    - 오류 코드/close 시점 확인
