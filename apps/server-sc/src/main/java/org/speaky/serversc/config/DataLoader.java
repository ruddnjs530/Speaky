package org.speaky.serversc.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.domain.User;
import org.speaky.serversc.domain.UserRole;
import org.speaky.serversc.domain.UserStatus;
import org.speaky.serversc.repository.UserRepository;
import org.speaky.serversc.domain.VoiceModel;
import org.speaky.serversc.repository.VoiceModelRepository;
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
        private final VoiceModelRepository voiceModelRepository;
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
                userRepository.save(host2);
                log.info("USER 사용자 생성: loginId={}", host2.getLoginId());

                User host3 = User.builder()
                                .loginId("st1234")
                                .password(passwordEncoder.encode("pd1234"))
                                .nickname("용문동쌍두마차")
                                .role(UserRole.USER)
                                .status(UserStatus.ACTIVE)
                                .build();
                userRepository.save(host3);
                log.info("USER 사용자 생성: loginId={}", host3.getLoginId());

                User host4 = User.builder()
                                .loginId("stream12")
                                .password(passwordEncoder.encode("passw12"))
                                .nickname("행신동섹시허리케인")
                                .role(UserRole.USER)
                                .status(UserStatus.ACTIVE)
                                .build();
                userRepository.save(host4);
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

                // Voice Data Seeding
                if (voiceModelRepository.count() == 0) {
                        log.info("Voice 데이터 생성 시작...");

                        // 1. Korone
                        voiceModelRepository.save(VoiceModel.builder()
                                        .name("Korone Voice")
                                        .modelPath("/rvc-code/assets/weights/korone.pth")
                                        .indexPath("/rvc-code/assets/indices/korone.index")
                                        .indexRate(0.75)
                                        .pitch(0)
                                        .protect(0.33)
                                        .rmsMixRate(1.0)
                                        .device("cuda")
                                        .isPublic(true)
                                        .sampleUri("avatar_1") // Frontend Mapping Key
                                        .build());

                        // 2. Aru
                        voiceModelRepository.save(VoiceModel.builder()
                                        .name("aru_voice")
                                        .modelPath("/rvc-code/assets/weights/0129_aru2.pth")
                                        .indexPath("/rvc-code/assets/indices/0129_aru2.index")
                                        .indexRate(0.7)
                                        .pitch(12)
                                        .protect(0.25)
                                        .rmsMixRate(1.0)
                                        .device("cuda")
                                        .isPublic(true)
                                        .sampleUri("avatar_2")
                                        .build());

                        // 3. Baekjongwon
                        voiceModelRepository.save(VoiceModel.builder()
                                        .name("baekjongwon_voice")
                                        .modelPath("/rvc-code/assets/weights/0128_baek.pth")
                                        .indexPath("/rvc-code/assets/indices/0128_baek.index")
                                        .indexRate(0.7)
                                        .pitch(-3)
                                        .protect(0.2)
                                        .rmsMixRate(1.0)
                                        .device("cuda")
                                        .isPublic(true)
                                        .sampleUri("avatar_3")
                                        .build());

                        // 4. Child
                        voiceModelRepository.save(VoiceModel.builder()
                                        .name("child_voice")
                                        .modelPath("/rvc-code/assets/weights/0127_child.pth")
                                        .indexPath("/rvc-code/assets/indices/0127_child.index")
                                        .indexRate(0.7)
                                        .pitch(6)
                                        .protect(0.20)
                                        .rmsMixRate(1.0)
                                        .device("cuda")
                                        .isPublic(true)
                                        .sampleUri("avatar_4")
                                        .build());

                        // 5. Trump
                        voiceModelRepository.save(VoiceModel.builder()
                                        .name("trump_voice")
                                        .modelPath("/rvc-code/assets/weights/0129_trump.pth")
                                        .indexPath("/rvc-code/assets/indices/0129_trump.index")
                                        .indexRate(0.5)
                                        .pitch(-3)
                                        .protect(0.3)
                                        .rmsMixRate(1.0)
                                        .device("cuda")
                                        .isPublic(true)
                                        .sampleUri("avatar_5")
                                        .build());

                        // 6. Criss
                        voiceModelRepository.save(VoiceModel.builder()
                                        .name("criss_voice")
                                        .modelPath("/rvc-code/assets/weights/0130_criss01.pth")
                                        .indexPath("/rvc-code/assets/indices/0130_criss01.index")
                                        .indexRate(0.5)
                                        .pitch(8)
                                        .protect(0.3)
                                        .rmsMixRate(1.0)
                                        .device("cuda")
                                        .isPublic(true)
                                        .sampleUri("avatar_6")
                                        .build());

                        // 7. Actor
                        voiceModelRepository.save(VoiceModel.builder()
                                        .name("actor_voice")
                                        .modelPath("/rvc-code/assets/weights/0203_actor.pth")
                                        .indexPath("/rvc-code/assets/indices/0203_actor.index")
                                        .indexRate(0.6)
                                        .pitch(-7)
                                        .protect(0.2)
                                        .rmsMixRate(1.0)
                                        .device("cuda")
                                        .isPublic(true)
                                        .sampleUri("avatar_7")
                                        .build());

                        // 8. Woman (No Index)
                        voiceModelRepository.save(VoiceModel.builder()
                                        .name("woman_voice")
                                        .modelPath("/rvc-code/assets/weights/0206_aihub_woman.pth")
                                        .indexPath("") // Empty
                                        .indexRate(0.0)
                                        .pitch(8)
                                        .protect(0.25)
                                        .rmsMixRate(1.0)
                                        .device("cuda")
                                        .isPublic(true)
                                        .sampleUri("avatar_8")
                                        .build());

                        // 9. Kane (No Index)
                        voiceModelRepository.save(VoiceModel.builder()
                                        .name("kane_voice")
                                        .modelPath("/rvc-code/assets/weights/chzzk_kane.pth")
                                        .indexPath("")
                                        .indexRate(0.0)
                                        .pitch(0)
                                        .protect(0.25)
                                        .rmsMixRate(1.0)
                                        .device("cuda")
                                        .isPublic(true)
                                        .sampleUri("avatar_9")
                                        .build());

                        // 10. Furina (No Index)
                        voiceModelRepository.save(VoiceModel.builder()
                                        .name("furina_voice")
                                        .modelPath("/rvc-code/assets/weights/genshin_furina.pth")
                                        .indexPath("")
                                        .indexRate(0.0)
                                        .pitch(11)
                                        .protect(0.25)
                                        .rmsMixRate(1.0)
                                        .device("cuda")
                                        .isPublic(true)
                                        .sampleUri("avatar_10")
                                        .build());

                        // 11. Tartaglia (No Index)
                        voiceModelRepository.save(VoiceModel.builder()
                                        .name("tartaglia_voice")
                                        .modelPath("/rvc-code/assets/weights/genshin_tartaglia.pth")
                                        .indexPath("")
                                        .indexRate(0.0)
                                        .pitch(-8)
                                        .protect(0.25)
                                        .rmsMixRate(1.0)
                                        .device("cuda")
                                        .isPublic(true)
                                        .sampleUri("avatar_11")
                                        .build());

                        // 12. Gawrgura (No Index)
                        voiceModelRepository.save(VoiceModel.builder()
                                        .name("gawrgura_voice")
                                        .modelPath("/rvc-code/assets/weights/hololive_gawrgura.pth")
                                        .indexPath("")
                                        .indexRate(0.0)
                                        .pitch(10)
                                        .protect(0.25)
                                        .rmsMixRate(1.0)
                                        .device("cuda")
                                        .isPublic(true)
                                        .sampleUri("avatar_12")
                                        .build());

                        // 13. Megumin (No Index)
                        voiceModelRepository.save(VoiceModel.builder()
                                        .name("megumin_voice")
                                        .modelPath("/rvc-code/assets/weights/konosuba_megumin.pth")
                                        .indexPath("")
                                        .indexRate(0.0)
                                        .pitch(10)
                                        .protect(0.25)
                                        .rmsMixRate(1.0)
                                        .device("cuda")
                                        .isPublic(true)
                                        .sampleUri("avatar_13")
                                        .build());

                        // 14. Kyubey (No Index)
                        voiceModelRepository.save(VoiceModel.builder()
                                        .name("kyubey_voice")
                                        .modelPath("/rvc-code/assets/weights/mamama_kyubey.pth")
                                        .indexPath("")
                                        .indexRate(0.0)
                                        .pitch(10)
                                        .protect(0.25)
                                        .rmsMixRate(1.0)
                                        .device("cuda")
                                        .isPublic(true)
                                        .sampleUri("avatar_14")
                                        .build());

                        log.info("Voice 데이터 생성 완료! (총 {}개)", voiceModelRepository.count());
                }
        }
}
