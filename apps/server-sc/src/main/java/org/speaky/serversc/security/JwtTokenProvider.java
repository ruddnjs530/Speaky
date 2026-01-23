package org.speaky.serversc.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.config.JwtProperties;
import org.speaky.serversc.domain.User;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * JWT 토큰 생성/검증 유틸리티
 * 
 * 기능:
 * - Access Token 생성
 * - Token 유효성 검증
 * - Token에서 loginId, userId 추출
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtTokenProvider {
    
    private final JwtProperties jwtProperties;
    
    /**
     * Secret Key 생성 (HMAC-SHA256)
     */
    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtProperties.getSecret().getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }
    
    /**
     * Access Token 생성
     * 
     * Claims:
     * - sub: loginId (주요 식별자)
     * - userId: DB PK
     * - role: 사용자 역할
     * - iat: 발급 시간
     * - exp: 만료 시간
     */
    public String generateAccessToken(User user) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtProperties.getExpiration() * 1000L);
        
        return Jwts.builder()
                .subject(user.getLoginId())
                .claim("userId", user.getUserId())
                .claim("role", user.getRole().name())
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(getSigningKey())
                .compact();
    }
    
    /**
     * Token에서 loginId 추출
     */
    public String extractLoginId(String token) {
        return parseClaims(token).getSubject();
    }
    
    /**
     * Token에서 userId 추출
     */
    public Long extractUserId(String token) {
        return parseClaims(token).get("userId", Long.class);
    }
    
    /**
     * Token에서 role 추출
     */
    public String extractRole(String token) {
        return parseClaims(token).get("role", String.class);
    }
    
    /**
     * Token 유효성 검증
     * @return true: 유효, false: 무효 또는 만료
     */
    public boolean validateToken(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.warn("JWT 토큰 만료됨: {}", e.getMessage());
        } catch (UnsupportedJwtException e) {
            log.warn("지원되지 않는 JWT 토큰: {}", e.getMessage());
        } catch (MalformedJwtException e) {
            log.warn("JWT 토큰 형식 오류: {}", e.getMessage());
        } catch (SecurityException e) {
            log.warn("JWT 서명 검증 실패: {}", e.getMessage());
        } catch (IllegalArgumentException e) {
            log.warn("JWT claims가 비어있음: {}", e.getMessage());
        }
        return false;
    }
    
    /**
     * Token 파싱하여 Claims 반환
     */
    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
    
    /**
     * Token 만료 시간 (초) 반환
     */
    public int getExpirationSeconds() {
        return jwtProperties.getExpiration();
    }
}
