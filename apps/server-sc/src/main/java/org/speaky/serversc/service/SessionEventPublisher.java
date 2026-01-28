package org.speaky.serversc.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.dto.Envelope;
import org.speaky.serversc.dto.From;
import org.speaky.serversc.dto.SessionEventPayload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * WebSocket 이벤트 발행 서비스
 * 
 * 세션 상태 변경 시 구독 중인 클라이언트들에게 실시간 이벤트 전송
 * 프로젝트 공통 Envelope 규약에 따라 메시지 래핑
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SessionEventPublisher {
    
    private static final int PROTOCOL_VERSION = 1;
    private static final String SERVER_ROLE = "SC";
    private static final String SERVER_CLIENT_ID = "server";
    
    private final SimpMessagingTemplate messagingTemplate;
    
    /**
     * 세션 이벤트 발행
     * 
     * SessionEventPayload를 Envelope로 래핑하여 전송
     * 
     * @param payload 이벤트 페이로드
     */
    public void publishSessionEvent(SessionEventPayload payload) {
        String destination = "/topic/session/" + payload.getSessionId();
        
        Envelope envelope = Envelope.builder()
                .v(PROTOCOL_VERSION)
                .type(payload.getEventType().name())
                .requestId(UUID.randomUUID().toString())
                .ts(System.currentTimeMillis())
                .channelId(null)  // TODO: channelId 지원 시 추가
                .sessionId(payload.getSessionId())
                .from(From.builder()
                        .role(SERVER_ROLE)
                        .clientId(SERVER_CLIENT_ID)
                        .build())
                .payload(payload.getSessionData())
                .build();
        
        messagingTemplate.convertAndSend(destination, envelope);
        
        log.info("Published event: type={}, sessionId={}, requestId={}, destination={}", 
                envelope.getType(), envelope.getSessionId(), envelope.getRequestId(), destination);
    }
}

