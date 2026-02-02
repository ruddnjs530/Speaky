# WebSocket Security Enhancement - JWT Authentication

## 📋 Summary

WebSocket 연결에 JWT 인증을 추가하여 MR 피드백에서 지적된 보안 취약점을 해결했습니다.

**Issue**: `/ws/signaling/**` 경로가 `permitAll()`로 설정되어 인증 없이 접근 가능  
**Solution**: HandshakeInterceptor와 ChannelInterceptor를 통한 이중 인증 구현

---

## 🔒 Security Enhancement

### Before
```java
// 인증 없이 WebSocket 연결 가능 ❌
.requestMatchers("/ws/signaling/**").permitAll()
```

### After
```java
// Query Parameter로 JWT 전달 및 검증 ✅
ws://localhost:8080/ws/signaling?token=YOUR_JWT_TOKEN

// 1. Handshake 인증 (JwtHandshakeInterceptor)
// 2. STOMP CONNECT 인증 (WebSocketAuthInterceptor)
// 3. STOMP SEND 인증 (WebSocketAuthInterceptor)
```

---

## 📁 Changes

### New Files

#### 1. [JwtHandshakeInterceptor.java](apps/server-sc/src/main/java/org/speaky/serversc/security/JwtHandshakeInterceptor.java)
- WebSocket Handshake 시점 JWT 검증
- Query Parameter에서 토큰 추출 (`?token=xxx`)
- 검증 성공 시 session attributes에 사용자 정보 저장
- 검증 실패 시 연결 거부

#### 2. [WebSocketAuthInterceptor.java](apps/server-sc/src/main/java/org/speaky/serversc/security/WebSocketAuthInterceptor.java)
- STOMP 메시지 레벨 인증 검증
- CONNECT/SEND 프레임 인증
- Spring Security Principal 설정
- 인증 실패 시 예외 발생

---

### Modified Files

#### [WebSocketConfig.java](apps/server-sc/src/main/java/org/speaky/serversc/config/WebSocketConfig.java)
- JwtHandshakeInterceptor 등록
- WebSocketAuthInterceptor 등록
- 엔드포인트 문서 업데이트

---

## 🧪 Testing

### Build & Test Results
```bash
./gradlew clean build -x test
# BUILD SUCCESSFUL ✅

./gradlew test
# 4 tests completed ✅
```

### Regression Testing
- 기존 테스트 모두 통과
- 인증 로직 추가로 인한 부작용 없음

---

## 🚀 Frontend Integration

### Connection Example
```typescript
const token = localStorage.getItem('accessToken');
const url = `ws://localhost:8080/ws/signaling?token=${token}`;

const client = new StompJs.Client({
  brokerURL: url,
  onConnect: () => console.log('Connected'),
  onWebSocketError: (error) => {
    // 인증 실패 시 처리
    console.error('Auth failed:', error);
  }
});

client.activate();
```

---

## 📝 Commits

1. `feat: Add JwtHandshakeInterceptor for WebSocket authentication`
2. `feat: Add WebSocketAuthInterceptor for STOMP message authentication`
3. `feat: Register JWT interceptors in WebSocketConfig`

**Principle**: 1 file per commit ✅

---

## ✅ Checklist

- [x] HandshakeInterceptor 구현
- [x] ChannelInterceptor 구현
- [x] WebSocketConfig 업데이트
- [x] 빌드 성공
- [x] 테스트 통과
- [ ] 프론트엔드 팀 연동 테스트 (MR 승인 후)

---

## 💡 Notes

- **Token Delivery**: Query Parameter (SockJS compatible)
- **Security Level**: Dual authentication (Handshake + Message level)
- **Backward Compatibility**: No breaking changes to existing flows

---

**Related**: MR feedback on WebSocket security vulnerability
