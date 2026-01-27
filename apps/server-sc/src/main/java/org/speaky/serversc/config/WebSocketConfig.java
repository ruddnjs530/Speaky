package org.speaky.serversc.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket 설정
 * 
 * STOMP over WebSocket을 사용한 실시간 메시징 구성
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    
    /**
     * 메시지 브로커 설정
     * 
     * - /app: 클라이언트 → 서버 메시지 prefix
     * - /topic: 서버 → 클라이언트 브로드캐스트 prefix
     */
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // 클라이언트에서 서버로 메시지 보낼 때 prefix
        config.setApplicationDestinationPrefixes("/app");
        
        // 서버에서 클라이언트로 메시지 보낼 때 prefix
        // /topic은 1:N 브로드캐스트 (여러 구독자에게 전달)
        config.enableSimpleBroker("/topic");
    }
    
    /**
     * STOMP 엔드포인트 등록
     * 
     * WebSocket 연결 경로: ws://localhost:8080/ws
     * SockJS fallback 지원으로 WebSocket 미지원 브라우저도 사용 가능
     */
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*") // MVP: 모든 origin 허용 (나중에 제한 필요)
                .withSockJS(); // WebSocket 미지원 시 폴링 등으로 fallback
    }
}
