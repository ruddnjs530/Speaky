package org.speaky.serversc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 공통 API 응답 래퍼
 * API 명세 기준 응답 형식
 * 
 * 성공:
 * {
 *   "success": true,
 *   "data": { ... },
 *   "error": null
 * }
 * 
 * 실패:
 * {
 *   "success": false,
 *   "data": null,
 *   "error": { "code": "...", "message": "..." }
 * }
 * 
 * @param <T> data 필드 타입
 */
@JsonInclude(JsonInclude.Include.ALWAYS)
public record ApiResponse<T>(
    boolean success,
    T data,
    ErrorInfo error
) {
    
    /**
     * 성공 응답 생성
     */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data, null);
    }
    
    /**
     * 실패 응답 생성
     */
    public static <T> ApiResponse<T> error(String code, String message) {
        return new ApiResponse<>(false, null, ErrorInfo.of(code, message));
    }
    
    /**
     * 실패 응답 생성 (ErrorInfo 직접 전달)
     */
    public static <T> ApiResponse<T> error(ErrorInfo errorInfo) {
        return new ApiResponse<>(false, null, errorInfo);
    }
}
