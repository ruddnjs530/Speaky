# Speaky API 명세서 (MVP)

> `hostLoginId` 표준화 기준 — REST API + WebSocket 시그널링 통신 규격

---

## 📋 목차

1. [용어 및 전제](#용어-및-전제)
2. [loginId 핸들 정책](#loginid-핸들-정책)
3. [인증 방식](#인증-방식)
4. [REST API](#rest-api)
5. [WebSocket API](#websocket-api)
6. [개발 참고사항](#개발-참고사항)
7. [DB 테이블 구성](#db-테이블-구성)

---

## 용어 및 전제

### 핵심 용어

- **userId**: DB 내부 식별용 PK (BIGINT Auto Increment). 외부에 직접 노출하지 않음.
- **loginId**: 사용자 핸들(채널 식별자). **불변(immutable)** + **unique**. URL/프론트/WS에서 채널 식별자로 사용.
- **hostLoginId**: "호스트의 loginId"를 의미하는 필드/Path 변수명(표준 용어).
- **Channel(채널)**: `hostLoginId`로 식별되는 호스트의 채널 개념.
- **Session(세션)**: 방송 1회 인스턴스. LIVE/ENDED 상태를 가짐.
- **SCS(Signaling/Control Server)**: WS 연결/구독/세션 이벤트 브로드캐스트 + WebRTC 시그널링 라우팅 전담.
- **Media Server**: SCS 지시에 따라 WebRTC 파이프라인 생성/응답. 클라이언트와 직접 시그널링하지 않음.

### 설계 원칙

- **외부 노출**: `loginId` (불변 핸들) 사용
- **내부 FK**: `userId` (BIGINT AI) 사용
- **REST**: 리소스 생성·상태 전이 담당
- **WebSocket**: 실시간 이벤트·시그널링 담당

---

## loginId 핸들 정책

> `loginId`는 "이메일"이 아니라 "채널 핸들"로 제한

### 포맷 규칙(권장)

- 저장/비교: **소문자 고정**
- 허용 문자: `a-z`, `0-9`, `_`
- 길이: `3~20`
- 정규식 예: `^[a-z0-9_]{3,20}$`

### 예약어(예시)

- `admin`, `root`, `system`
- `api`, `ws`, `auth`, `login`, `signup`, `me`
- `channels`, `sessions`, `voice-models`

### 불변성(immutable)

- 생성 이후 `loginId` 변경 API 제공하지 않음
- 서버 레벨에서도 변경 경로 금지

---

## 인증 방식

### JWT Bearer 인증

- REST/WS 공통: `Authorization: Bearer <accessToken>` 사용

**인증 헤더 예시**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## REST API

### Base URL

- 개발: `http://localhost:8080/api/v1`
- 운영: `https://api.speaky.com/api/v1`

### 공통 응답 형식

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

### 에러 응답

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

### 에러 코드 (권장)

- `401 Unauthorized`: 토큰 없음/만료
- `403 Forbidden`: 권한 없음(타인의 세션 종료 등)
- `404 Not Found`: `hostLoginId` 또는 `sessionId` 없음
- `409 Conflict`: 상태 충돌(이미 LIVE 등)

---

## 1. 인증 API

### 1.1 로그인

```
POST /api/v1/auth/login
```

**Request Body**

```json
{
  "loginId": "streamer123",
  "password": "password123"
}
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "user": {
      "userId": 123,
      "loginId": "streamer123",
      "nickname": "김경원"
    }
  }
}
```

| 필드     | 타입   | 설명                                       |
| -------- | ------ | ------------------------------------------ |
| loginId  | string | 불변 핸들 (3~20자, 소문자/숫자/언더스코어) |
| password | string | 비밀번호                                   |

---

## 2. AI/보이스 API

### 2.1 보이스팩 목록 조회

```
GET /api/v1/voice-models
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "voiceModelId": "vm_001",
        "name": "AI 보이스 1",
        "thumbnailUrl": "https://cdn.speaky.com/models/thumb_01.png",
        "sampleUrl": "https://cdn.speaky.com/models/sample_01.mp3",
        "status": "AVAILABLE"
      },
      {
        "voiceModelId": "vm_002",
        "name": "AI 보이스 2",
        "thumbnailUrl": "https://cdn.speaky.com/models/thumb_02.png",
        "sampleUrl": "https://cdn.speaky.com/models/sample_02.mp3",
        "status": "AVAILABLE"
      }
    ]
  }
}
```

| status 값 | 설명         |
| --------- | ------------ |
| AVAILABLE | 사용 가능    |
| LOADING   | 모델 로딩 중 |
| ERROR     | 오류 발생    |

---

## 3. 채널 API

### 3.1 채널 상태 조회

```
GET /api/v1/channels/{hostLoginId}/state
```

**Path Parameters**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| hostLoginId | string | 호스트의 loginId (핸들) |

**Response 200 (방송 중)**

```json
{
  "success": true,
  "data": {
    "hostLoginId": "streamer123",
    "activeSessionId": "s_999"
  }
}
```

**Response 200 (방송 중이 아님)**

```json
{
  "success": true,
  "data": {
    "hostLoginId": "streamer123",
    "activeSessionId": null
  }
}
```

> **활용**: Viewer 단일 화면용. `activeSessionId`가 존재하면 LIVE 상태로 판단

---

## 4. 세션 API

### 4.1 세션 생성 및 방송 시작

```
POST /api/v1/sessions
Authorization: Bearer {token}
Content-Type: application/json
```

> **Host 전용**: 세션 생성과 방송 시작을 하나의 API로 통합

**Request Body**

```json
{
  "title": "파이썬 기초 강의 #5",
  "voiceModelId": "vm_001"
}
```

| 필드         | 타입   | 필수 | 설명                           |
| ------------ | ------ | ---- | ------------------------------ |
| title        | string | Y    | 방송 제목 (최대 50자)          |
| voiceModelId | string | N    | 보이스팩 ID (없으면 원본 음성) |

**Response 201 Created**

```json
{
  "success": true,
  "data": {
    "sessionId": "s_999",
    "hostLoginId": "streamer123",
    "status": "LIVE",
    "title": "파이썬 기초 강의 #5",
    "startedAt": "2026-01-20T13:00:00+09:00"
  }
}
```

**Response 409 Conflict (이미 방송 중)**

```json
{
  "success": false,
  "error": {
    "code": "ALREADY_LIVE",
    "message": "이미 진행 중인 방송이 있습니다"
  }
}
```

---

### 4.2 세션 종료

```
POST /api/v1/sessions/{sessionId}/end
Authorization: Bearer {token}
Content-Type: application/json
```

**Path Parameters**
| 파라미터 | 타입 | 설명 |
|---------|------|------|
| sessionId | string | 세션 ID |

**Request Body**

```json
{}
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "sessionId": "s_999",
    "status": "ENDED",
    "endedAt": "2026-01-20T14:00:00+09:00",
    "endedReason": "HOST_ENDED"
  }
}
```

| endedReason 값 | 설명               |
| -------------- | ------------------ |
| HOST_ENDED     | 호스트가 직접 종료 |
| ERROR          | 시스템 오류로 종료 |
| TIMEOUT        | 타임아웃           |

**Response 403 Forbidden (권한 없음)**

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "타인의 세션을 종료할 수 없습니다"
  }
}
```

---

## REST API 엔드포인트 요약

| Method | Endpoint                             | 설명                | 인증     |
| ------ | ------------------------------------ | ------------------- | -------- |
| POST   | /api/v1/auth/login                   | 로그인              | X        |
| GET    | /api/v1/voice-models                 | 보이스팩 목록       | X        |
| GET    | /api/v1/channels/{hostLoginId}/state | 채널 상태 조회      | X        |
| POST   | /api/v1/sessions                     | 세션 생성+방송 시작 | Y (Host) |
| POST   | /api/v1/sessions/{sessionId}/end     | 세션 종료           | Y (Host) |

---

## WebSocket API

### 연결 정보

**Endpoint**

```
wss://{domain}/ws
```

**인증**

- 권장: 핸드셰이크 헤더 `Authorization: Bearer <accessToken>`

---

### 공통 Envelope

모든 WS 메시지는 아래 형태를 따릅니다.

```json
{
  "type": "STRING",
  "requestId": "uuid-optional",
  "ts": "2026-01-20T13:00:00.000+09:00",
  "from": {
    "clientId": "c_123",
    "role": "HOST|VIEWER|SERVER|MEDIA"
  },
  "to": {
    "hostLoginId": "streamer123",
    "sessionId": "s_999"
  },
  "payload": {}
}
```

| 필드           | 타입   | 설명                                              |
| -------------- | ------ | ------------------------------------------------- |
| type           | string | 이벤트 타입                                       |
| requestId      | string | CMD 메시지에서만 클라이언트가 생성 (응답 시 echo) |
| ts             | string | ISO 8601 타임스탬프                               |
| from.clientId  | string | 클라이언트 고유 ID (탭 단위)                      |
| from.role      | string | HOST / VIEWER / SERVER / MEDIA                    |
| to.hostLoginId | string | 채널 구독/채널 이벤트 시 필수                     |
| to.sessionId   | string | 시그널링/세션 이벤트 시 필수                      |
| payload        | object | 이벤트별 데이터                                   |

### requestId 규칙

- **CMD(요청형)** 메시지에서만 클라이언트가 생성하여 포함
- 서버 응답/에러는 동일 `requestId`를 echo

### `to` 필드 규칙

- 채널 구독/채널 이벤트: `to.hostLoginId` 필수
- 시그널링/세션 이벤트: `to.sessionId` 필수

---

## WebSocket 이벤트 타입

### 1. 연결 / 유지 (Heartbeat)

#### WS_HELLO (SCS → Client)

```json
{
  "type": "WS_HELLO",
  "ts": "2026-01-20T13:00:00.000+09:00",
  "from": {
    "role": "SERVER"
  },
  "payload": {
    "clientId": "c_123",
    "role": "HOST",
    "userId": 123,
    "loginId": "streamer123"
  }
}
```

> 연결 직후 1회 전송. `userId`는 내 계정 식별용이지만, 외부 URL 라우팅에는 `loginId`만 사용

---

#### PING (Client → SCS)

```json
{
  "type": "PING",
  "requestId": "req_001",
  "ts": "2026-01-20T13:00:00.000+09:00",
  "from": {
    "clientId": "c_123",
    "role": "VIEWER"
  },
  "payload": {
    "seq": 10
  }
}
```

> 20~30초 주기로 전송

---

#### PONG (SCS → Client)

```json
{
  "type": "PONG",
  "requestId": "req_001",
  "ts": "2026-01-20T13:00:01.000+09:00",
  "from": {
    "role": "SERVER"
  },
  "payload": {
    "seq": 10
  }
}
```

---

### 2. Viewer 단일 화면: 채널 구독 + 라이브 이벤트

#### CHANNEL_ATTACH (Viewer → SCS)

```json
{
  "type": "CHANNEL_ATTACH",
  "requestId": "req_002",
  "ts": "2026-01-20T13:00:00.000+09:00",
  "from": {
    "clientId": "c_456",
    "role": "VIEWER"
  },
  "to": {
    "hostLoginId": "streamer123"
  },
  "payload": {}
}
```

> Viewer가 호스트 채널 이벤트 구독

---

#### CHANNEL_ATTACHED (SCS → Viewer)

```json
{
  "type": "CHANNEL_ATTACHED",
  "requestId": "req_002",
  "ts": "2026-01-20T13:00:01.000+09:00",
  "from": {
    "role": "SERVER"
  },
  "to": {
    "hostLoginId": "streamer123"
  },
  "payload": {
    "hostLoginId": "streamer123",
    "activeSessionId": "s_999"
  }
}
```

> 구독 결과 + 현재 상태. `activeSessionId`가 null이면 대기 상태

**activeSessionId가 null인 경우**

```json
{
  "type": "CHANNEL_ATTACHED",
  "requestId": "req_002",
  "ts": "2026-01-20T13:00:01.000+09:00",
  "from": {
    "role": "SERVER"
  },
  "to": {
    "hostLoginId": "streamer123"
  },
  "payload": {
    "hostLoginId": "streamer123",
    "activeSessionId": null
  }
}
```

---

#### SESSION_LIVE_STARTED (SCS → Viewer 구독자 전체)

```json
{
  "type": "SESSION_LIVE_STARTED",
  "ts": "2026-01-20T13:05:00.000+09:00",
  "from": {
    "role": "SERVER"
  },
  "to": {
    "hostLoginId": "streamer123",
    "sessionId": "s_999"
  },
  "payload": {
    "title": "파이썬 기초 강의 #5",
    "startedAt": "2026-01-20T13:05:00.000+09:00"
  }
}
```

> **중요**: Viewer에게 `voiceModelId`는 전달하지 않음 (보안)

---

#### SESSION_ENDED (SCS → Viewer 구독자 전체)

```json
{
  "type": "SESSION_ENDED",
  "ts": "2026-01-20T14:00:00.000+09:00",
  "from": {
    "role": "SERVER"
  },
  "to": {
    "hostLoginId": "streamer123",
    "sessionId": "s_999"
  },
  "payload": {
    "endedAt": "2026-01-20T14:00:00.000+09:00",
    "reason": "HOST_ENDED"
  }
}
```

> 재생 → 대기 전환

---

#### CHANNEL_NOT_FOUND (SCS → Viewer)

```json
{
  "type": "CHANNEL_NOT_FOUND",
  "requestId": "req_002",
  "ts": "2026-01-20T13:00:01.000+09:00",
  "from": {
    "role": "SERVER"
  },
  "to": {
    "hostLoginId": "invalid_user"
  },
  "payload": {}
}
```

> 존재하지 않는 `hostLoginId`

---

### 3. WebRTC 시그널링 (Viewer ↔ SCS ↔ Media)

> Media Server는 클라이언트와 직접 시그널링하지 않으며, 항상 SCS가 라우팅

#### VIEWER_WATCH_START (Viewer → SCS)

```json
{
  "type": "VIEWER_WATCH_START",
  "requestId": "req_003",
  "ts": "2026-01-20T13:05:10.000+09:00",
  "from": {
    "clientId": "c_456",
    "role": "VIEWER"
  },
  "to": {
    "hostLoginId": "streamer123",
    "sessionId": "s_999"
  },
  "payload": {}
}
```

> 시청(시그널링) 시작 선언 (권장)

---

#### SIGNALING_READY (SCS → Viewer)

```json
{
  "type": "SIGNALING_READY",
  "requestId": "req_003",
  "ts": "2026-01-20T13:05:11.000+09:00",
  "from": {
    "role": "SERVER"
  },
  "to": {
    "sessionId": "s_999"
  },
  "payload": {}
}
```

> 준비 완료 (선택)

---

#### SIG_SDP_OFFER (Viewer → SCS)

```json
{
  "type": "SIG_SDP_OFFER",
  "requestId": "req_004",
  "ts": "2026-01-20T13:05:12.000+09:00",
  "from": {
    "clientId": "c_456",
    "role": "VIEWER"
  },
  "to": {
    "sessionId": "s_999"
  },
  "payload": {
    "sdp": "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\n..."
  }
}
```

> Viewer가 Offer 생성 후 전송

---

#### SIG_SDP_ANSWER (SCS → Viewer)

```json
{
  "type": "SIG_SDP_ANSWER",
  "requestId": "req_004",
  "ts": "2026-01-20T13:05:13.000+09:00",
  "from": {
    "role": "MEDIA"
  },
  "to": {
    "sessionId": "s_999"
  },
  "payload": {
    "sdp": "v=0\r\no=- 987654321 2 IN IP4 192.168.1.100\r\n..."
  }
}
```

> Media의 Answer를 전달

---

#### SIG_ICE (양방향)

**Viewer → SCS**

```json
{
  "type": "SIG_ICE",
  "ts": "2026-01-20T13:05:14.000+09:00",
  "from": {
    "clientId": "c_456",
    "role": "VIEWER"
  },
  "to": {
    "sessionId": "s_999"
  },
  "payload": {
    "candidate": "candidate:1 1 UDP 2130706431 192.168.1.50 54321 typ host",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

**SCS → Viewer**

```json
{
  "type": "SIG_ICE",
  "ts": "2026-01-20T13:05:15.000+09:00",
  "from": {
    "role": "MEDIA"
  },
  "to": {
    "sessionId": "s_999"
  },
  "payload": {
    "candidate": "candidate:2 1 UDP 2130706430 192.168.1.100 12345 typ host",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

> ICE 전송 (다수/비동기)

---

### 4. 시청자 수 (선택)

#### VIEWER_COUNT_GET (Host/Viewer → SCS)

```json
{
  "type": "VIEWER_COUNT_GET",
  "requestId": "req_005",
  "ts": "2026-01-20T13:10:00.000+09:00",
  "from": {
    "clientId": "c_123",
    "role": "HOST"
  },
  "to": {
    "sessionId": "s_999"
  },
  "payload": {}
}
```

---

#### VIEWER_COUNT (SCS → 요청자)

```json
{
  "type": "VIEWER_COUNT",
  "requestId": "req_005",
  "ts": "2026-01-20T13:10:01.000+09:00",
  "from": {
    "role": "SERVER"
  },
  "to": {
    "sessionId": "s_999"
  },
  "payload": {
    "count": 12
  }
}
```

---

#### VIEWER_COUNT_UPDATED (SCS → Host 및 구독 Viewer)

```json
{
  "type": "VIEWER_COUNT_UPDATED",
  "ts": "2026-01-20T13:11:00.000+09:00",
  "from": {
    "role": "SERVER"
  },
  "to": {
    "sessionId": "s_999"
  },
  "payload": {
    "count": 13
  }
}
```

> 자동 갱신 (선택)

---

### 5. 단일 활성 연결 강제 (멀티탭/멀티디바이스 비허용)

> 정책 선택(권장): **신규 접속 거부(Strict)** 또는 **기존 연결 교체(Replace)**

#### FORCE_DISCONNECT (SCS → 기존 Client)

```json
{
  "type": "FORCE_DISCONNECT",
  "ts": "2026-01-20T13:15:00.000+09:00",
  "from": {
    "role": "SERVER"
  },
  "payload": {
    "code": "REPLACED_BY_NEW_CONNECTION",
    "message": "다른 곳에서 로그인되어 연결이 종료됩니다."
  }
}
```

> Replace 정책에서 사용

---

#### ERROR (SCS → 신규 Client)

```json
{
  "type": "ERROR",
  "requestId": null,
  "ts": "2026-01-20T13:15:00.000+09:00",
  "from": {
    "role": "SERVER"
  },
  "payload": {
    "code": "ALREADY_CONNECTED",
    "message": "이미 다른 곳에서 접속 중입니다."
  }
}
```

> Strict 정책에서 사용

---

### 6. 공통 에러

#### ERROR (SCS → Client)

```json
{
  "type": "ERROR",
  "requestId": "req_006",
  "ts": "2026-01-20T13:20:00.000+09:00",
  "from": {
    "role": "SERVER"
  },
  "payload": {
    "code": "INVALID_STATE",
    "message": "세션이 ENDED 상태입니다"
  }
}
```

| 에러 코드         | 설명           |
| ----------------- | -------------- |
| UNAUTHORIZED      | 토큰 불가/만료 |
| NOT_FOUND         | 리소스 없음    |
| INVALID_STATE     | 잘못된 상태    |
| FORBIDDEN         | 권한 없음      |
| RATE_LIMIT        | 요청 제한 초과 |
| ALREADY_CONNECTED | 이미 접속 중   |

---

## WebSocket 이벤트 요약

| Type                   | 방향                | 설명                  |
| ---------------------- | ------------------- | --------------------- |
| `WS_HELLO`             | SCS → Client        | 연결 직후 1회         |
| `PING`                 | Client → SCS        | 20~30초 주기          |
| `PONG`                 | SCS → Client        | PING 응답             |
| `CHANNEL_ATTACH`       | Viewer → SCS        | 채널 이벤트 구독      |
| `CHANNEL_ATTACHED`     | SCS → Viewer        | 구독 결과 + 현재 상태 |
| `SESSION_LIVE_STARTED` | SCS → Viewer(전체)  | 라이브 시작           |
| `SESSION_ENDED`        | SCS → Viewer(전체)  | 라이브 종료           |
| `CHANNEL_NOT_FOUND`    | SCS → Viewer        | 존재하지 않는 호스트  |
| `VIEWER_WATCH_START`   | Viewer → SCS        | 시청 시작 선언        |
| `SIGNALING_READY`      | SCS → Viewer        | 준비 완료             |
| `SIG_SDP_OFFER`        | Viewer → SCS        | Offer 전달            |
| `SIG_SDP_ANSWER`       | SCS → Viewer        | Answer 전달           |
| `SIG_ICE`              | 양방향              | ICE Candidate         |
| `VIEWER_COUNT_GET`     | Host/Viewer → SCS   | 시청자 수 요청        |
| `VIEWER_COUNT`         | SCS → 요청자        | 시청자 수 응답        |
| `VIEWER_COUNT_UPDATED` | SCS → Host & Viewer | 시청자 수 자동 갱신   |
| `FORCE_DISCONNECT`     | SCS → 기존 Client   | Replace 정책          |
| `ERROR`                | SCS → Client        | 에러 통지             |

---

## 개발 참고사항

### Viewer 단일 화면 구현 흐름(권장)

1. Viewer 페이지 진입
2. WS 연결 성공 → `CHANNEL_ATTACH(hostLoginId)`
3. `CHANNEL_ATTACHED.activeSessionId` 확인
   - `null` → 대기 UI
   - 값 존재 → 즉시 `VIEWER_WATCH_START` 및 WebRTC 시그널링 시작
4. `SESSION_LIVE_STARTED` 수신 시
   - 대기 → 재생으로 전환, 시그널링 시작
5. `SESSION_ENDED` 수신 시
   - PeerConnection 종료, 대기로 전환

> **WS가 끊겼을 때 폴백**: `GET /api/v1/channels/{hostLoginId}/state`

---

### WS에서 자주 실수하는 포인트(체크리스트)

- ⚠️ `SIG_ICE`가 `SIG_SDP_ANSWER`보다 먼저 도착할 수 있음
  - **해결**: ICE를 큐에 저장했다가 remoteDescription 설정 후 add
- ⚠️ WS 재연결 시 `CHANNEL_ATTACH`는 반드시 다시 수행
- ⚠️ `sessionId`가 ENDED 상태인데 시그널링 메시지를 보내면 `INVALID_STATE` 처리

---

## DB 테이블 구성

### DB 내부 PK vs 외부 채널 식별자

- `users.user_id` (BIGINT AI, PK): 내부 조인/참조/정합성의 기준
- `users.login_id` (VARCHAR, UNIQUE, NOT NULL, 불변): 외부 채널 식별자(= hostLoginId)

### 추천 테이블(최소)

#### users

```sql
CREATE TABLE users (
  user_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  login_id VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_login_id (login_id)
);
```

#### voice_models

```sql
CREATE TABLE voice_models (
  voice_model_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  thumbnail_url VARCHAR(500),
  sample_url VARCHAR(500),
  status ENUM('AVAILABLE', 'LOADING', 'ERROR') DEFAULT 'AVAILABLE',
  owner_user_id BIGINT,
  FOREIGN KEY (owner_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
```

#### sessions

```sql
CREATE TABLE sessions (
  session_id VARCHAR(50) PRIMARY KEY,
  host_user_id BIGINT NOT NULL,
  voice_model_id VARCHAR(50),
  title VARCHAR(100) NOT NULL,
  status ENUM('LIVE', 'ENDED') DEFAULT 'LIVE',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  ended_reason VARCHAR(50),
  FOREIGN KEY (host_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (voice_model_id) REFERENCES voice_models(voice_model_id) ON DELETE SET NULL,
  INDEX idx_host_user_id (host_user_id),
  INDEX idx_status (status)
);
```

> **중요**: `hostLoginId`는 "외부에서 들어오는 키"이고, DB에서는 항상 `host_user_id`로 정규화하여 사용

### 런타임/캐시로 두는 값(ERD에 넣지 않음 권장)

- WS `clientId`, `requestId`
- WebRTC `sdp`, `candidate` 등 시그널링 페이로드
- `activeSessionId`는 응답에 쓰지만 DB 컬럼으로는 파생 가능(필수 아님)
- `media_server_id`는 MVP에서는 런타임 라우팅(메모리/Redis) 권장

---

## URL/프론트 라우팅 예시

### Viewer 접속

```
https://example.com/stream/{hostLoginId}
```

**예시**

```
https://example.com/stream/streamer123
```

### 해당 페이지에서

- WS `CHANNEL_ATTACH`의 `to.hostLoginId = "streamer123"`
- 필요 시 REST `/api/v1/channels/streamer123/state`로 폴백

---

## 변경 로그

- **2026-01-21**: `hostLoginId` 표준화 버전으로 전면 개정
  - `email` → `loginId` 전환
  - REST 엔드포인트를 `/sessions` 중심으로 재구성
  - WebSocket 이벤트 타입 표준화 (`CHANNEL_ATTACH`, `SESSION_LIVE_STARTED` 등)
  - MVP 범위에 맞게 불필요한 API 제거 (채널 팔로우, 채널 관리 등)
- **2026-01-20**: 초기 버전 작성

---

**버전**: 2.0 (MVP)  
**작성일**: 2026-01-21  
**기준 문서**: `docs/BE/SC/ERD/README.md`
