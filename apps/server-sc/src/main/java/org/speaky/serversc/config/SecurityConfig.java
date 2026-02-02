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
                // CORS 설정 활성화
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))

                // CSRF 설정 (Stateless REST API이므로 비활성화)
                .csrf(csrf -> csrf.disable())

                // Session 사용 안 함 (Stateless)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

                // 요청 권한 설정
                .authorizeHttpRequests(auth -> auth
                        // Public 엔드포인트 (순서 중요: 구체적인 경로를 먼저)
                        .requestMatchers("/h2-console/**").permitAll() // H2 콘솔 (개발용)
                        .requestMatchers("/api/v1/auth/**").permitAll() // 로그인/회원가입
                        .requestMatchers("/api/v1/voice-models").permitAll() // 보이스팩 목록
                        .requestMatchers("/api/v1/channels/*/state").permitAll() // 채널 상태 조회

                        // 나머지는 인증 필요
                        .anyRequest().authenticated())

                // H2 Console 헤더 설정
                .headers(headers -> headers
                        .frameOptions(frame -> frame.sameOrigin()) // H2 콘솔 iframe 허용
                )

                // JWT 인증 필터 추가 (H2 콘솔 제외)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    /**
     * CORS 상세 설정
     */
    @Bean
    public org.springframework.web.cors.CorsConfigurationSource corsConfigurationSource() {
        org.springframework.web.cors.CorsConfiguration configuration = new org.springframework.web.cors.CorsConfiguration();

        // 프론트엔드 출처 허용
        configuration.addAllowedOrigin("http://localhost:5173");
        configuration.addAllowedOrigin("http://127.0.0.1:5173");

        // 모든 HTTP 메서드 허용
        configuration.addAllowedMethod("*");

        // 모든 헤더 허용
        configuration.addAllowedHeader("*");

        // 인증 정보 포함 허용 (쿠키 등)
        configuration.setAllowCredentials(true);

        org.springframework.web.cors.UrlBasedCorsConfigurationSource source = new org.springframework.web.cors.UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
