package org.speaky.serversc.dto;

/**
 * 에러 정보 DTO
 * API 명세 기준 에러 응답 형식
 * 
 * @param code 에러 코드 (예: UNAUTHORIZED, FORBIDDEN)
 * @param message 에러 메시지
 */
public record ErrorInfo(
    String code,
    String message
) {
    /**
     * 에러 정보 생성
     */
    public static ErrorInfo of(String code, String message) {
        return new ErrorInfo(code, message);
    }
}
