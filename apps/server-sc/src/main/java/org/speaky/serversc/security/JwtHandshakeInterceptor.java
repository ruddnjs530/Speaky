package org.speaky.serversc.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.net.URI;
import java.util.Arrays;
import java.util.Map;

/**
 * WebSocket Handshake 시점에서 JWT 인증을 수행하는 Interceptor
 * 
 * - Query Parameter에서 JWT 토큰 추출 (?token=xxx)
 * - JWT 유효성 검증
 * - 검증 성공 시 WebSocketSession attributes에 사용자 정보 저장
 * - 검증 실패 시 Handshake 거부
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtHandshakeInterceptor implements HandshakeInterceptor {
    
    private final JwtTokenProvider jwtTokenProvider;
    
    /**
     * WebSocket Handshake 이전에 호출됨
     * 
     * @param request HTTP 요청
     * @param response HTTP 응답
     * @param wsHandler WebSocket 핸들러
     * @param attributes WebSocket Session에 저장될 attributes
     * @return true: Handshake 허용, false: Handshake 거부
     */
    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes) throws Exception {
        
        // 1. Query parameter에서 토큰 추출
        String token = extractTokenFromQuery(request);
        
        if (token == null || token.isEmpty()) {
            log.warn("WebSocket handshake rejected: No token provided from {}", 
                    request.getRemoteAddress());
            return false; // Handshake 거부
        }
        
        // 2. JWT 검증
        if (!jwtTokenProvider.validateToken(token)) {
            log.warn("WebSocket handshake rejected: Invalid token from {}", 
                    request.getRemoteAddress());
            return false;
        }
        
        // 3. 사용자 정보 추출 및 attributes에 저장
        try {
            Long userId = jwtTokenProvider.extractUserId(token);
            String loginId = jwtTokenProvider.extractLoginId(token);
            String role = jwtTokenProvider.extractRole(token);
            
            attributes.put("userId", userId);
            attributes.put("loginId", loginId);
            attributes.put("role", role);
            
            log.info("WebSocket handshake approved: userId={}, loginId={}", userId, loginId);
            return true;
            
        } catch (Exception e) {
            log.error("Failed to extract user info from token: {}", e.getMessage());
            return false;
        }
    }
    
    /**
     * WebSocket Handshake 이후에 호출됨
     */
    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception) {
        // 필요 시 후처리 로직 추가
    }
    
    /**
     * Query parameter에서 토큰 추출
     * 
     * @param request HTTP 요청
     * @return JWT 토큰 또는 null
     */
    private String extractTokenFromQuery(ServerHttpRequest request) {
        URI uri = request.getURI();
        String query = uri.getQuery();
        
        if (query == null || query.isEmpty()) {
            return null;
        }
        
        // "token=xxx" 형태에서 토큰 추출
        return Arrays.stream(query.split("&"))
                .filter(param -> param.startsWith("token="))
                .map(param -> param.substring(6)) // "token=" 이후
                .findFirst()
                .orElse(null);
    }
}
