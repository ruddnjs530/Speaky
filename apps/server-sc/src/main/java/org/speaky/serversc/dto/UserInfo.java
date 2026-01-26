package org.speaky.serversc.dto;

/**
 * 사용자 정보 DTO
 * 로그인 응답에 포함되는 사용자 기본 정보
 * 
 * @param userId 사용자 ID (DB PK)
 * @param loginId 로그인 ID (채널 핸들)
 * @param nickname 닉네임
 */
public record UserInfo(
    Long userId,
    String loginId,
    String nickname
) {}
