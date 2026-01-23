package org.speaky.serversc.dto;

/**
 * 로그인 응답 DTO
 * API 명세 기준 응답 형식
 * 
 * @param accessToken JWT Access Token
 * @param tokenType 토큰 타입 (Bearer)
 * @param expiresIn 만료 시간 (초)
 * @param user 사용자 정보
 */
public record LoginResponse(
    String accessToken,
    String tokenType,
    int expiresIn,
    UserInfo user
) {
    /**
     * 로그인 응답 생성
     */
    public static LoginResponse of(String accessToken, int expiresIn, UserInfo user) {
        return new LoginResponse(accessToken, "Bearer", expiresIn, user);
    }
}
