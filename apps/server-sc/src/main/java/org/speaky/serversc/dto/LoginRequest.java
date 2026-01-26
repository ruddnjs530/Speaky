package org.speaky.serversc.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 로그인 요청 DTO
 * 
 * @param loginId 로그인 ID (3~20자, 소문자/숫자/언더스코어)
 * @param password 비밀번호
 */
public record LoginRequest(
    @NotBlank(message = "loginId는 필수입니다")
    @Size(min = 3, max = 20, message = "loginId는 3~20자여야 합니다")
    @Pattern(regexp = "^[a-z0-9_]{3,20}$", message = "loginId는 소문자, 숫자, 언더스코어만 허용됩니다")
    String loginId,
    
    @NotBlank(message = "password는 필수입니다")
    String password
) {}
