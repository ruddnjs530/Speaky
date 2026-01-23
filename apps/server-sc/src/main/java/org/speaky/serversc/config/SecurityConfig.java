package org.speaky.serversc.config;

import lombok.RequiredArgsConstructor;
import org.speaky.serversc.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Spring Security 설정
 * - JWT 기반 Stateless 인증
 * - BCrypt 비밀번호 암호화
 * - Public 엔드포인트 허용
 */
@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {
    
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    
    /**
     * 비밀번호 암호화 인코더
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
    
    /**
     * Security Filter Chain 설정
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // CSRF 비활성화 (REST API)
            .csrf(csrf -> csrf.disable())
            
            // Session 사용 안 함 (Stateless)
            .sessionManagement(session -> 
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            
            // 요청 권한 설정
            .authorizeHttpRequests(auth -> auth
                // Public 엔드포인트
                .requestMatchers(
                    "/api/v1/auth/**",      // 로그인/회원가입
                    "/h2-console/**",       // H2 콘솔 (개발용)
                    "/api/v1/voice-models", // 보이스팩 목록 (인증 불필요)
                    "/api/v1/channels/*/state" // 채널 상태 조회 (인증 불필요)
                ).permitAll()
                
                // 나머지는 인증 필요
                .anyRequest().authenticated()
            )
            
            // H2 Console은 iframe 사용 (개발용)
            .headers(headers -> headers
                .frameOptions(frame -> frame.sameOrigin())
            )
            
            // JWT 인증 필터 추가
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        
        return http.build();
    }
}
