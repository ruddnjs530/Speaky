# 실시간 시청자 수 집계 백엔드 설계

## 1. 개요
현재 `server-sc` (Signaling Server)에는 시청자 수를 집계하는 로직이 존재하지 않습니다.
WebSocket(STOMP) 연결 및 채널 구독(Subscribe) 이벤트를 기반으로 실시간 시청자 수를 집계하고, 변경 사항을 브로드캐스팅하는 기능을 설계합니다.

## 2. 아키텍처
- **이벤트 기반 추적**: Spring Framework의 `SessionSubscribeEvent`, `SessionUnsubscribeEvent`, `SessionDisconnectEvent`를 활용하여 사용자의 입장/퇴장을 감지합니다.
- **In-Memory 저장소**: 실시간성이 중요하고 빈번한 업데이트가 발생하므로 `Memory`(`ConcurrentHashMap`)에 상태를 관리합니다. (추후 확장을 위해 Redis로 변경 가능)
- **채널별 격리**: 각 방송 채널(`channelId`)별로 고유한 시청자 집합(`Set<String> sessionId`)을 관리하여 중복 집계를 방지합니다.

## 3. 데이터 구조 (Memory)

```java
// SignalingService 또는 별도 ViewerCountService 관리

// Key: Channel ID (방송 채널 ID)
// Value: Set of Client IDs (참가자 고유 ID 집합 - 중복 방지)
private final Map<String, Set<String>> channelViewers = new ConcurrentHashMap<>();
```

> **Set을 사용하는 이유**: 단순 `AtomicInteger` 카운터를 사용하면, 동일한 클라이언트가 네트워크 불안정으로 재접속하거나 중복 구독 요청을 보낼 때 카운트가 뻥튀기될 위험이 있습니다. `Set`으로 고유 ID를 관리하면 정확성을 보장할 수 있습니다.

## 4. 이벤트 처리 흐름

### A. 입장 (구독) 처리
**Trigger**: `SessionSubscribeEvent`
1. 이벤트에서 `destination` 추출 (`/topic/channel/{channelId}`)
2. `channelId` 파싱
3. `headerAccessor`에서 `clientId` (또는 `sessionId`) 추출
4. 해당 채널의 `Set`에 `clientId` **추가**
5. `Set`의 크기(Size) 확인 (현재 인원 수)
6. 해당 채널에 변경된 인원 수 브로드캐스트 (`SYS_VIEWER_COUNT`)

### B. 퇴장 (구독 해제) 처리
**Trigger**: `SessionUnsubscribeEvent`
1. 이벤트에서 `subscriptionId` 등을 통해 매핑된 정보를 찾아야 하나, STOMP 프로토콜 특성상 Unsubscribe 이벤트만으로는 어떤 채널인지 알기 어려울 수 있음.
2. **대안**: `SimpMessageHeaderAccessor`의 `sessionAttributes`에 자신이 구독한 채널 목록을 `List<String>` 형태로 별도 저장해두고 관리하는 것이 안전함.

### C. 연결 종료 (강제 종료) 처리
**Trigger**: `SessionDisconnectEvent` (이미 구현된 `handleWebSocketDisconnect` 확장)
1. `clientId` 추출
2. 모든 채널의 `Set`에서 해당 `clientId` **제거** (또는 sessionAttributes에 저장된 '구독한 채널' 목록을 순회하며 제거)
3. 영향받은 채널들에 변경된 인원 수 브로드캐스트

## 5. 프로토콜 정의

### 서버 -> 클라이언트 (Broadcast)
시청자 수가 변경될 때마다 해당 채널(`/topic/channel/{channelId}`)의 모든 구독자에게 전송합니다.

- **Destination**: `/topic/channel/{channelId}`
- **Type**: `SYS_VIEWER_COUNT`
- **Payload**:

```json
{
  "count": 1234
}
```

## 6. 구현 상세 가이드

### 1) WebSocket 이벤트 리스너 추가
`SignalingService.java`에 다음 리스너들을 추가합니다.

```java
@EventListener
public void handleSubscribeEvent(SessionSubscribeEvent event) {
    StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
    String destination = accessor.getDestination();
    
    // /topic/channel/{channelId} 패턴 확인
    if (destination != null && destination.startsWith("/topic/channel/")) {
        String channelId = destination.substring("/topic/channel/".length());
        String clientId = (String) accessor.getSessionAttributes().get("clientId");
        
        // 메모리에 추가
        addViewer(channelId, clientId);
        
        // 브로드캐스트
        broadcastViewerCount(channelId);
    }
}

@EventListener
public void handleDisconnectEvent(SessionDisconnectEvent event) {
    // 기존 disconnect 로직...
    
    // 추가: 시청자 목록에서 제거
    String clientId = ...;
    removeViewerFromAllChannels(clientId);
}
```

### 2) 동시성 이슈 고려
- `ConcurrentHashMap`과 `Collections.synchronizedSet` 또는 `ConcurrentHashMap.newKeySet()`을 사용하여 Thread-Safe하게 관리해야 합니다.

### 3) 초기값 동기화
- 클라이언트가 처음 접속했을 때 현재 인원수를 바로 알아야 합니다.
- **방법**: `SUBSCRIBE` 이벤트 처리 직후에, **해당 클라이언트에게만**(`convertAndSendToUser` 활용, 혹은 전체 브로드캐스트로 퉁침) 현재 카운트를 전송하거나,
- 단순히 누군가 들어오면 전체 브로드캐스트가 되므로, 클라이언트는 접속 직후 날아오는 첫 `SYS_VIEWER_COUNT` 메시지를 받아 렌더링하면 됩니다.
