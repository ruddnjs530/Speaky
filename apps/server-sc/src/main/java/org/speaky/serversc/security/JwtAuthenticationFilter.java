package org.speaky.serversc.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.repository.UserRepository;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * JWT 인증 필터
 * 
 * 동작:
 * 1. Authorization 헤더에서 Bearer 토큰 추출
 * 2. 토큰 유효성 검증
 * 3. 유효하면 SecurityContext에 Authentication 설정
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    
    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";
    
    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;
    
    @Override
    protected void doFilterInternal(HttpServletRequest request, 
                                    HttpServletResponse response, 
                                    FilterChain filterChain) throws ServletException, IOException {
        
        try {
            String path = request.getRequestURI();
            if(path.startsWith("/h2-console")){
                filterChain.doFilter(request, response);
                return;
            }

            String token = extractToken(request);
            
            if (StringUtils.hasText(token) && jwtTokenProvider.validateToken(token)) {
                String loginId = jwtTokenProvider.extractLoginId(token);
                Long userId = jwtTokenProvider.extractUserId(token);
                String role = jwtTokenProvider.extractRole(token);
                
                // 사용자 존재 및 활성 상태 확인
                userRepository.findByLoginId(loginId)
                    .filter(user -> user.isActive())
                    .ifPresent(user -> {
                        // Authentication 객체 생성
                        var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
                        var authentication = new UsernamePasswordAuthenticationToken(
                                user,           // principal
                                null,           // credentials
                                authorities     // authorities
                        );
                        
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                        log.debug("인증 성공: loginId={}, userId={}, role={}", loginId, userId, role);
                    });
            }
        } catch (Exception e) {
            log.warn("JWT 인증 처리 중 오류: {}", e.getMessage());
            // 인증 실패 시 SecurityContext는 비어있음 (접근 거부됨)
        }
        
        filterChain.doFilter(request, response);
    }
    
    /**
     * Authorization 헤더에서 Bearer 토큰 추출
     */
    private String extractToken(HttpServletRequest request) {
        String bearerToken = request.getHeader(AUTHORIZATION_HEADER);
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith(BEARER_PREFIX)) {
            return bearerToken.substring(BEARER_PREFIX.length());
        }
        return null;
    }
}
