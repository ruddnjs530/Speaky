package org.speaky.serversc.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.domain.User;
import org.speaky.serversc.domain.UserRole;
import org.speaky.serversc.domain.UserStatus;
import org.speaky.serversc.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 테스트 데이터 로더
 * 애플리케이션 시작 시 테스트용 사용자 생성
 * 
 * 테스트 계정:
 * - loginId: streamer123, password: password123 (USER)
 * - loginId: admin_user, password: admin123 (ADMIN)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataLoader implements CommandLineRunner {
    
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    
    @Override
    public void run(String... args) {
        // 테스트 데이터가 없을 때만 생성
        if (userRepository.count() > 0) {
            log.info("테스트 데이터가 이미 존재합니다. 건너뜁니다.");
            return;
        }
        
        log.info("테스트 데이터 생성 시작...");
        
        // 테스트 USER 사용자
        User host = User.builder()
                .loginId("streamer123")
                .password(passwordEncoder.encode("password123"))
                .nickname("김경원")
                .role(UserRole.USER)
                .status(UserStatus.ACTIVE)
                .build();
        userRepository.save(host);
        log.info("USER 사용자 생성: loginId={}", host.getLoginId());

        User host2 = User.builder()
                .loginId("st123")
                .password(passwordEncoder.encode("pd123"))
                .nickname("중리동버추얼신자")
                .role(UserRole.USER)
                .status(UserStatus.ACTIVE)
                .build();
        userRepository.save(host);
        log.info("USER 사용자 생성: loginId={}", host2.getLoginId());

        User host3 = User.builder()
                .loginId("st1234")
                .password(passwordEncoder.encode("pd1234"))
                .nickname("용문동쌍두마차")
                .role(UserRole.USER)
                .status(UserStatus.ACTIVE)
                .build();
        userRepository.save(host);
        log.info("USER 사용자 생성: loginId={}", host3.getLoginId());

        User host4 = User.builder()
                .loginId("stream12")
                .password(passwordEncoder.encode("passw12"))
                .nickname("행신동섹시허리케인")
                .role(UserRole.USER)
                .status(UserStatus.ACTIVE)
                .build();
        userRepository.save(host);
        log.info("USER 사용자 생성: loginId={}", host4.getLoginId());
        
        // 테스트 ADMIN 사용자
        User admin = User.builder()
                .loginId("admin_user")
                .password(passwordEncoder.encode("admin123"))
                .nickname("관리자")
                .role(UserRole.ADMIN)
                .status(UserStatus.ACTIVE)
                .build();
        userRepository.save(admin);
        log.info("ADMIN 사용자 생성: loginId={}", admin.getLoginId());
        
        // 차단된 사용자 (테스트용)
        User blocked = User.builder()
                .loginId("blocked_user")
                .password(passwordEncoder.encode("password123"))
                .nickname("차단된사용자")
                .role(UserRole.USER)
                .status(UserStatus.BLOCKED)
                .build();
        userRepository.save(blocked);
        log.info("BLOCKED 사용자 생성: loginId={}", blocked.getLoginId());
        
        log.info("테스트 데이터 생성 완료! (총 {}명)", userRepository.count());
    }
}
