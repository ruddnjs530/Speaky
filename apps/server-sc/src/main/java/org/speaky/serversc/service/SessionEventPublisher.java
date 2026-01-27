package org.speaky.serversc.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.dto.SessionEventPayload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * WebSocket 이벤트 발행 서비스
 * 
 * 세션 상태 변경 시 구독 중인 클라이언트들에게 실시간 이벤트 전송
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SessionEventPublisher {
    
    private final SimpMessagingTemplate messagingTemplate;
    
    /**
     * 세션 이벤트 발행
     * 
     * @param payload 이벤트 페이로드
     */
    public void publishSessionEvent(SessionEventPayload payload) {
        String destination = "/topic/session/" + payload.getSessionId();
        
        messagingTemplate.convertAndSend(destination, payload);
        
        log.info("Published event: type={}, sessionId={}, destination={}", 
                payload.getEventType(), payload.getSessionId(), destination);
    }
}
