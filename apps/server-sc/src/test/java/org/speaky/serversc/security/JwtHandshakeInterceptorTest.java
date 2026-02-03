package org.speaky.serversc.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.socket.WebSocketHandler;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("JwtHandshakeInterceptor 테스트")
class JwtHandshakeInterceptorTest {

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private WebSocketHandler wsHandler;

    @Mock
    private ServerHttpResponse response;

    @InjectMocks
    private JwtHandshakeInterceptor interceptor;

    private Map<String, Object> attributes;

    @BeforeEach
    void setUp() {
        attributes = new HashMap<>();
    }

    @Test
    @DisplayName("유효한 토큰으로 Handshake 성공")
    void testBeforeHandshake_ValidToken_Success() throws Exception {
        // Given
        String validToken = "valid.jwt.token";
        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        servletRequest.setQueryString("token=" + validToken);
        ServerHttpRequest request = new ServletServerHttpRequest(servletRequest);

        when(jwtTokenProvider.validateToken(validToken)).thenReturn(true);
        when(jwtTokenProvider.extractUserId(validToken)).thenReturn(123L);
        when(jwtTokenProvider.extractLoginId(validToken)).thenReturn("testuser");
        when(jwtTokenProvider.extractRole(validToken)).thenReturn("USER");

        // When
        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        // Then
        assertThat(result).isTrue();
        assertThat(attributes).containsEntry("userId", 123L);
        assertThat(attributes).containsEntry("loginId", "testuser");
        assertThat(attributes).containsEntry("role", "USER");

        verify(jwtTokenProvider).validateToken(validToken);
        verify(jwtTokenProvider).extractUserId(validToken);
        verify(jwtTokenProvider).extractLoginId(validToken);
        verify(jwtTokenProvider).extractRole(validToken);
    }

    @Test
    @DisplayName("토큰 없이 Handshake 실패")
    void testBeforeHandshake_MissingToken_Failure() throws Exception {
        // Given
        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        // No query string
        ServerHttpRequest request = new ServletServerHttpRequest(servletRequest);

        // When
        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        // Then
        assertThat(result).isFalse();
        assertThat(attributes).isEmpty();

        verify(jwtTokenProvider, never()).validateToken(anyString());
    }

    @Test
    @DisplayName("빈 토큰으로 Handshake 실패")
    void testBeforeHandshake_EmptyToken_Failure() throws Exception {
        // Given
        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        servletRequest.setQueryString("token=");
        ServerHttpRequest request = new ServletServerHttpRequest(servletRequest);

        // When
        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        // Then
        assertThat(result).isFalse();
        assertThat(attributes).isEmpty();

        verify(jwtTokenProvider, never()).validateToken(anyString());
    }

    @Test
    @DisplayName("유효하지 않은 토큰으로 Handshake 실패")
    void testBeforeHandshake_InvalidToken_Failure() throws Exception {
        // Given
        String invalidToken = "invalid.jwt.token";
        MockHttpServletRequest servletRequest = new MockHttpServletRequest();
        servletRequest.setQueryString("token=" + invalidToken);
        ServerHttpRequest request = new ServletServerHttpRequest(servletRequest);

        when(jwtTokenProvider.validateToken(invalidToken)).thenReturn(false);

        // When
        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        // Then
        assertThat(result).isFalse();
        assertThat(attributes).isEmpty();

        verify(jwtTokenProvider).validateToken(invalidToken);
        verify(jwtTokenProvider, never()).extractUserId(anyString());
    }

    @Test
    @DisplayName("afterHandshake는 항상 성공")
    void testAfterHandshake_AlwaysSuccess() {
        // When & Then
        // Should not throw any exception
        interceptor.afterHandshake(null, null, null, null);
    }
}
