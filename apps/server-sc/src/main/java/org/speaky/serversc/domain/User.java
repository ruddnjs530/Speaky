package org.speaky.serversc.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * 사용자 Entity
 * 
 * 핵심 필드:
 * - userId: DB 내부 식별용 PK (Auto Increment)
 * - loginId: 채널 핸들 (불변, unique, 3~20자, 소문자/숫자/언더스코어)
 * - password: BCrypt 암호화된 비밀번호
 * - nickname: 표시 이름
 * - role: HOST 또는 ADMIN
 * - status: ACTIVE, BLOCKED, DELETED
 * 
 * @see <a href="docs/BE/SC/API명세.md">API 명세서</a>
 */
@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_user_login_id", columnList = "loginId", unique = true)
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long userId;
    
    /**
     * 로그인 ID (채널 핸들)
     * - 불변 (immutable)
     * - unique
     * - 3~20자
     * - 소문자, 숫자, 언더스코어만 허용
     */
    @Column(nullable = false, unique = true, length = 20, updatable = false)
    @NotBlank(message = "loginId는 필수입니다")
    @Size(min = 3, max = 20, message = "loginId는 3~20자여야 합니다")
    @Pattern(regexp = "^[a-z0-9_]{3,20}$", message = "loginId는 소문자, 숫자, 언더스코어만 허용됩니다")
    private String loginId;
    
    /**
     * 비밀번호 (BCrypt 해시)
     */
    @Column(nullable = false)
    @NotBlank(message = "password는 필수입니다")
    private String password;
    
    /**
     * 닉네임 (표시 이름)
     */
    @Column(nullable = false, length = 50)
    @NotBlank(message = "nickname은 필수입니다")
    @Size(max = 50, message = "nickname은 최대 50자입니다")
    private String nickname;
    
    /**
     * 사용자 역할
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private UserRole role = UserRole.HOST;
    
    /**
     * 계정 상태
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    @Builder.Default
    private UserStatus status = UserStatus.ACTIVE;
    
    /**
     * 생성 시간
     */
    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;
    
    /**
     * 수정 시간
     */
    @UpdateTimestamp
    private LocalDateTime updatedAt;
    
    /**
     * 닉네임 변경
     */
    public void updateNickname(String nickname) {
        this.nickname = nickname;
    }
    
    /**
     * 비밀번호 변경
     */
    public void updatePassword(String encodedPassword) {
        this.password = encodedPassword;
    }
    
    /**
     * 계정 상태 변경
     */
    public void updateStatus(UserStatus status) {
        this.status = status;
    }
    
    /**
     * 활성 계정 여부 확인
     */
    public boolean isActive() {
        return this.status == UserStatus.ACTIVE;
    }
}
