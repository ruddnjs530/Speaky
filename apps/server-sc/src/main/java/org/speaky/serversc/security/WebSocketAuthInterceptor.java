package org.speaky.serversc.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * STOMP 메시지 레벨에서 인증을 검증하는 Interceptor
 * 
 * - CONNECT 프레임: Handshake에서 저장된 session attributes 확인
 * - SUBSCRIBE 프레임: 구독 권한 검증 및 destination별 접근 제어
 * - SEND 프레임: 메시지 전송 권한 검증
 * - 인증 실패 시 예외 발생하여 메시지 전송 차단
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WebSocketAuthInterceptor implements ChannelInterceptor {
    
    /**
     * 메시지 전송 전에 호출되어 인증 검증
     * 
     * @param message STOMP 메시지
     * @param channel 메시지 채널
     * @return 원본 메시지 (검증 통과 시)
     * @throws IllegalStateException 인증 실패 시
     * @throws java.nio.file.AccessDeniedException 권한 부족 시
     */
    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = 
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        
        if (accessor == null) {
            return message;
        }
        
        StompCommand command = accessor.getCommand();
        
        // CONNECT 프레임: Handshake에서 저장한 사용자 정보 확인
        if (StompCommand.CONNECT.equals(command)) {
            validateConnect(accessor);
        }
        
        // SUBSCRIBE 프레임: 구독 권한 검증
        if (StompCommand.SUBSCRIBE.equals(command)) {
            validateSubscribe(accessor);
        }
        
        // SEND 프레임: 메시지 전송 권한 검증
        if (StompCommand.SEND.equals(command)) {
            validateSend(accessor);
        }
        
        return message;
    }
    
    /**
     * STOMP CONNECT 프레임 인증 검증
     * 
     * Handshake 단계에서 JWT가 검증되고 session attributes에 저장되었는지 확인
     */
    private void validateConnect(StompHeaderAccessor accessor) {
        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        
        if (sessionAttributes == null || !sessionAttributes.containsKey("userId")) {
            log.warn("STOMP CONNECT rejected: No userId in session attributes");
            throw new IllegalStateException("Unauthorized WebSocket connection: authentication required");
        }
        
        Long userId = (Long) sessionAttributes.get("userId");
        String loginId = (String) sessionAttributes.get("loginId");
        
        // Principal 설정 (Spring Security 통합)
        accessor.setUser(() -> loginId);
        
        log.info("STOMP CONNECT authorized: userId={}, loginId={}", userId, loginId);
    }
    
    /**
     * STOMP SUBSCRIBE 프레임 권한 검증
     * 
     * 인증된 사용자만 구독 가능하며, destination별 접근 제어 수행
     */
    private void validateSubscribe(StompHeaderAccessor accessor) {
        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        
        // 기본 인증 확인
        if (sessionAttributes == null || !sessionAttributes.containsKey("userId")) {
            log.warn("STOMP SUBSCRIBE rejected: No userId in session");
            throw new IllegalStateException("Unauthorized subscription: authentication required");
        }
        
        Long userId = (Long) sessionAttributes.get("userId");
        String destination = accessor.getDestination();
        String role = (String) sessionAttributes.get("role");
        
        // destination별 권한 검증
        if (destination != null && destination.startsWith("/topic/admin/")) {
            if (!"ADMIN".equals(role)) {
                log.warn("STOMP SUBSCRIBE rejected: userId={} attempted to subscribe to admin topic: {}",
                        userId, destination);
                throw new IllegalStateException("Admin role required for this topic");
            }
        }
        
        log.info("STOMP SUBSCRIBE authorized: userId={}, destination={}", userId, destination);
    }
    
    /**
     * STOMP SEND 프레임 권한 검증
     * 
     * 현재는 session에 userId가 있는지만 확인
     * 필요 시 메시지 destination별 권한 검증 추가 가능
     */
    private void validateSend(StompHeaderAccessor accessor) {
        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        
        if (sessionAttributes == null || !sessionAttributes.containsKey("userId")) {
            log.warn("STOMP SEND rejected: No userId in session");
            throw new IllegalStateException("Unauthorized message: authentication required");
        }
        
        // 필요 시 destination별 권한 검증
        // String destination = accessor.getDestination();
        // if (destination != null && destination.startsWith("/app/admin/")) {
        //     String role = (String) sessionAttributes.get("role");
        //     if (!"ADMIN".equals(role)) {
        //         throw new IllegalStateException("Admin role required");
        //     }
        // }
    }
}
