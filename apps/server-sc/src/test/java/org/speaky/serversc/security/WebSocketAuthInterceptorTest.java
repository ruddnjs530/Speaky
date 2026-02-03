package org.speaky.serversc.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("WebSocketAuthInterceptor 테스트")
class WebSocketAuthInterceptorTest {

    @Mock
    private MessageChannel channel;

    @InjectMocks
    private WebSocketAuthInterceptor interceptor;

    private Map<String, Object> sessionAttributes;

    @BeforeEach
    void setUp() {
        sessionAttributes = new HashMap<>();
    }

    @Test
    @DisplayName("CONNECT 프레임 - 인증 성공")
    void testPreSend_ConnectFrame_Authenticated_Success() {
        // Given
        sessionAttributes.put("userId", 123L);
        sessionAttributes.put("loginId", "testuser");
        sessionAttributes.put("role", "USER");
        
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setSessionAttributes(sessionAttributes);
        accessor.setLeaveMutable(true); // 핵심: mutable 상태 유지
        
        Message<?> message = MessageBuilder
                .createMessage(new byte[0], accessor.getMessageHeaders());

        // When
        Message<?> result = interceptor.preSend(message, channel);

        // Then
        assertThat(result).isNotNull();
        assertThat(result).isEqualTo(message);
        
        // Principal 검증
        StompHeaderAccessor resultAccessor = StompHeaderAccessor.wrap(result);
        assertThat(resultAccessor.getUser()).isNotNull();
        assertThat(resultAccessor.getUser().getName()).isEqualTo("testuser");
    }

    @Test
    @DisplayName("CONNECT 프레임 - 인증 실패 (userId 없음)")
    void testPreSend_ConnectFrame_NoUserId_Failure() {
        // Given
        sessionAttributes.put("loginId", "testuser"); // userId 없음
        
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setSessionAttributes(sessionAttributes);
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        // When & Then
        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Unauthorized WebSocket connection");
    }

    @Test
    @DisplayName("CONNECT 프레임 - 인증 실패 (session attributes 없음)")
    void testPreSend_ConnectFrame_NoSessionAttributes_Failure() {
        // Given
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setSessionAttributes(null);
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        // When & Then
        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Unauthorized WebSocket connection");
    }

    @Test
    @DisplayName("SEND 프레임 - 인증 성공")
    void testPreSend_SendFrame_Authenticated_Success() {
        // Given
        sessionAttributes.put("userId", 123L);
        sessionAttributes.put("loginId", "testuser");
        
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setSessionAttributes(sessionAttributes);
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        // When
        Message<?> result = interceptor.preSend(message, channel);

        // Then
        assertThat(result).isNotNull();
        assertThat(result).isEqualTo(message);
    }

    @Test
    @DisplayName("SEND 프레임 - 인증 실패")
    void testPreSend_SendFrame_NotAuthenticated_Failure() {
        // Given
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setSessionAttributes(sessionAttributes); // 빈 attributes
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        // When & Then
        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Unauthorized message");
    }

    @Test
    @DisplayName("SUBSCRIBE 프레임 - 인증 성공")
    void testPreSend_SubscribeFrame_Authenticated_Success() {
        // Given
        sessionAttributes.put("userId", 123L);
        sessionAttributes.put("loginId", "testuser");
        sessionAttributes.put("role", "USER");
        
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setSessionAttributes(sessionAttributes);
        accessor.setDestination("/topic/session/123");
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        // When
        Message<?> result = interceptor.preSend(message, channel);

        // Then
        assertThat(result).isNotNull();
        assertThat(result).isEqualTo(message);
    }

    @Test
    @DisplayName("SUBSCRIBE 프레임 - 인증 실패 (userId 없음)")
    void testPreSend_SubscribeFrame_NotAuthenticated_Failure() {
        // Given
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setSessionAttributes(sessionAttributes); // 빈 attributes
        accessor.setDestination("/topic/session/123");
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        // When & Then
        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Unauthorized subscription");
    }

    @Test
    @DisplayName("SUBSCRIBE 프레임 - Admin 토픽 권한 부족")
    void testPreSend_SubscribeFrame_AdminTopic_AccessDenied() {
        // Given
        sessionAttributes.put("userId", 123L);
        sessionAttributes.put("loginId", "testuser");
        sessionAttributes.put("role", "USER"); // ADMIN 아님
        
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setSessionAttributes(sessionAttributes);
        accessor.setDestination("/topic/admin/dashboard");
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        // When & Then
        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Admin role required");
    }

    @Test
    @DisplayName("SUBSCRIBE 프레임 - Admin 토픽 권한 성공")
    void testPreSend_SubscribeFrame_AdminTopic_Success() {
        // Given
        sessionAttributes.put("userId", 1L);
        sessionAttributes.put("loginId", "admin");
        sessionAttributes.put("role", "ADMIN");
        
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setSessionAttributes(sessionAttributes);
        accessor.setDestination("/topic/admin/dashboard");
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        // When
        Message<?> result = interceptor.preSend(message, channel);

        // Then
        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("DISCONNECT 프레임 - 인증 검증 없이 통과")
    void testPreSend_DisconnectFrame_NoAuthCheck_Success() {
        // Given
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.DISCONNECT);
        accessor.setSessionAttributes(sessionAttributes);
        Message<?> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        // When
        Message<?> result = interceptor.preSend(message, channel);

        // Then
        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("postSend는 항상 성공")
    void testPostSend_AlwaysSuccess() {
        // When & Then
        // Should not throw any exception
        interceptor.postSend(null, null, true);
    }

    @Test
    @DisplayName("afterSendCompletion는 항상 성공")
    void testAfterSendCompletion_AlwaysSuccess() {
        // When & Then
        // Should not throw any exception
        interceptor.afterSendCompletion(null, null, true, null);
    }
}
