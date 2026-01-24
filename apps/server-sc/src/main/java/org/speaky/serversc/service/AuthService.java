package org.speaky.serversc.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.domain.User;
import org.speaky.serversc.dto.LoginRequest;
import org.speaky.serversc.dto.LoginResponse;
import org.speaky.serversc.dto.UserInfo;
import org.speaky.serversc.exception.AuthenticationException;
import org.speaky.serversc.exception.UserBlockedException;
import org.speaky.serversc.repository.UserRepository;
import org.speaky.serversc.security.JwtTokenProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 인증 서비스
 * - 로그인 처리
 * - JWT 토큰 발급
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {
    
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    
    /**
     * 로그인 처리
     * 
     * @param request 로그인 요청 (loginId, password)
     * @return 로그인 응답 (accessToken, user info)
     * @throws AuthenticationException 인증 실패 시
     * @throws UserBlockedException 계정이 차단/삭제 상태일 때
     */
    public LoginResponse login(LoginRequest request) {
        log.debug("로그인 시도: loginId={}", request.loginId());
        
        // 1. 사용자 조회
        User user = userRepository.findByLoginId(request.loginId())
                .orElseThrow(() -> {
                    log.warn("로그인 실패 - 사용자 없음: loginId={}", request.loginId());
                    return new AuthenticationException("아이디 또는 비밀번호가 일치하지 않습니다");
                });
        
        // 2. 비밀번호 검증
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            log.warn("로그인 실패 - 비밀번호 불일치: loginId={}", request.loginId());
            throw new AuthenticationException("아이디 또는 비밀번호가 일치하지 않습니다");
        }
        
        // 3. 계정 상태 확인
        if (!user.isActive()) {
            log.warn("로그인 실패 - 비활성 계정: loginId={}, status={}", 
                    request.loginId(), user.getStatus());
            throw new UserBlockedException("계정이 비활성화되었습니다");
        }
        
        // 4. JWT 토큰 생성
        String accessToken = jwtTokenProvider.generateAccessToken(user);
        int expiresIn = jwtTokenProvider.getExpirationSeconds();
        
        // 5. 응답 생성
        UserInfo userInfo = new UserInfo(
                user.getUserId(),
                user.getLoginId(),
                user.getNickname()
        );
        
        log.info("로그인 성공: loginId={}, userId={}", user.getLoginId(), user.getUserId());
        
        return LoginResponse.of(accessToken, expiresIn, userInfo);
    }
}
