# Session Lifecycle Completion - Media Server Resource Cleanup

## 📋 Summary

방송 세션 종료 및 WebSocket 연결 해제 시 미디어 서버 리소스를 자동으로 정리하여 리소스 누수를 방지합니다.

**Related**: S14P11B103-165 - Session Lifecycle Management

---

## 🎯 Motivation

### Problem
- ❌ 방송 종료 시 미디어 서버 Room 리소스 미정리
- ❌ WebSocket 연결 해제 시 참가자 정보 미삭제
- ❌ 리소스 누수로 인한 메모리 낭비
- ❌ 고아 세션/참가자 데이터 축적

### Solution
- ✅ `endBroadcast()` 시 `deleteRoom()` 자동 호출
- ✅ WebSocket disconnect 시 `leaveRoom()` 자동 호출
- ✅ 비치명적 에러 처리로 플로우 안정성 확보
- ✅ 향후 배치 cleanup 전략 TODO 명시

---

## 📁 Changes

### Modified Files

#### [MODIFY] [SessionService.java](apps/server-sc/src/main/java/org/speaky/serversc/service/SessionService.java)

**변경 내용**: `endBroadcast()` 메서드에 `deleteRoom()` 호출 추가

**Before**:
```java
public void endBroadcast(String sessionId, Long userId) {
    // ... 세션 종료 로직
    sessionRepository.save(session);
    eventPublisher.publishBroadcastEnded(session);
}
```

**After**:
```java
public void endBroadcast(String sessionId, Long userId) {
    // ... 세션 종료 로직
    sessionRepository.save(session);
    eventPublisher.publishBroadcastEnded(session);
    
    // 미디어 서버 Room 삭제
    try {
        mediaServerClient.deleteRoom(sessionId);
        log.info("Media server room deleted: sessionId={}", sessionId);
    } catch (MediaServerException e) {
        // 비치명적 에러 - 로깅만 하고 계속 진행
        log.warn("Failed to delete media server room: sessionId={}, errorCode={}",
                sessionId, e.getErrorCode(), e);
        // TODO: 주기적인 cleanup 배치 작업에서 처리
    }
}
```

**핵심 설계**:
- ✅ **비치명적 처리**: 미디어 서버 장애 시에도 세션 종료 플로우 완료
- ✅ **스택 트레이스 로깅**: 디버깅을 위한 전체 예외 정보 기록
- ✅ **구체적 예외**: `MediaServerException`만 catch

---

#### [MODIFY] [SignalingService.java](apps/server-sc/src/main/java/org/speaky/serversc/service/SignalingService.java)

**변경 내용**: WebSocket disconnect 이벤트 핸들러 추가

**구현**:
```java
@EventListener
public void handleWebSocketDisconnect(SessionDisconnectEvent event) {
    // Session attributes에서 정보 추출
    String sessionId = (String) sessionAttributes.get("sessionId");
    String clientId = (String) sessionAttributes.get("clientId");

    // 미디어 서버에 leaveRoom 호출
    try {
        mediaServerClient.leaveRoom(sessionId, clientId);
        log.info("Media server leaveRoom success");
    } catch (MediaServerException e) {
        log.warn("Failed to leave media server room", e);
        // TODO: 주기적인 cleanup 배치 작업에서 처리
    }
}
```

**핵심 설계**:
- ✅ **이벤트 기반**: Spring의 `@EventListener`로 자동 감지
- ✅ **Session Attributes 활용**: Handshake에서 저장한 정보 재사용
- ✅ **Graceful Degradation**: 실패 시에도 로깅만 하고 계속 진행

---

## 🔑 Design Decisions

### 1. 비치명적 에러 처리
**이유**: 미디어 서버 일시적 장애가 세션 종료를 막아서는 안 됨

```java
// ✅ Good: 로깅만, 플로우 계속
try {
    mediaServerClient.deleteRoom(sessionId);
} catch (MediaServerException e) {
    log.warn("...", e);
}
```

### 2. 구체적 예외 타입
```java
// ❌ Bad: 너무 광범위
catch (Exception e) { ... }

// ✅ Good: 의도한 예외만
catch (MediaServerException e) { ... }
```

### 3. 스택 트레이스 로깅
```java
// ✅ Good: 전체 예외 객체 전달
log.warn("Failed: sessionId={}, errorCode={}", sessionId, e.getErrorCode(), e);
```

### 4. TODO 주석으로 향후 전략 명시
```java
// TODO: 주기적인 cleanup 배치 작업에서 처리
// - 미디어 서버의 고아 Room/참가자 목록 조회 및 정리
```

---

## 🧪 Testing

### Build & Test Results
```bash
./gradlew test
# BUILD SUCCESSFUL ✅
# All tests passing
```

### Error Scenarios
| 시나리오 | 동작 | 결과 |
|---|---|---|
| deleteRoom 성공 | 정상 삭제 | ✅ 세션 종료 + Room 삭제 |
| deleteRoom 실패 | 로깅 후 계속 | ✅ 세션 종료 (Room은 TODO) |
| leaveRoom 성공 | 정상 삭제 | ✅ 참가자 정리 |
| leaveRoom 실패 | 로깅 후 계속 | ✅ 연결 해제 (참가자는 TODO) |

---

## 📊 Impact

### Before → After

**방송 종료**:
```
Before: 세션 DB 업데이트 → 끝 (❌ Room 남음)
After:  세션 DB 업데이트 → deleteRoom() → 끝 (✅ Room 정리)
```

**WebSocket 해제**:
```
Before: 연결 종료 → 끝 (❌ 참가자 남음)
After:  연결 종료 → leaveRoom() → 끝 (✅ 참가자 정리)
```

---

## 🚀 Future Improvements (TODO)

### Cleanup 배치 작업
```java
@Scheduled(fixedRate = 1800000) // 30분마다
public void cleanupOrphanedResources() {
    // 고아 Room/참가자 정리
}
```

---

## 📝 Commits

1. `feat: Add deleteRoom call in SessionService.endBroadcast`
2. `refactor: Improve deleteRoom exception handling based on MR feedback`
3. `feat: Add WebSocket disconnect handler with leaveRoom integration`

**Principle**: 1 logical change per commit ✅

---

## ✅ Checklist

- [x] deleteRoom 통합
- [x] leaveRoom 통합
- [x] 비치명적 에러 처리
- [x] 스택 트레이스 로깅
- [x] TODO 주석 추가
- [x] MR 피드백 반영
- [x] develop 리베이스
- [x] 테스트 통과
- [ ] 코드 리뷰
- [ ] develop 머지

---

**Implements**: Automatic media server resource cleanup on session end and WebSocket disconnect
