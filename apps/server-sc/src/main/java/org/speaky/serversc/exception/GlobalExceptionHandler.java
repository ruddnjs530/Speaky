package org.speaky.serversc.exception;

import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.dto.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

/**
 * 전역 예외 처리기
 * 모든 컨트롤러에서 발생하는 예외를 일관된 형식으로 처리
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {
    
    /**
     * 인증 실패 예외 처리 (401)
     * - 사용자 없음
     * - 비밀번호 불일치
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Void>> handleAuthenticationException(
            AuthenticationException ex) {
        log.warn("인증 실패: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error("UNAUTHORIZED", ex.getMessage()));
    }
    
    /**
     * 계정 차단 예외 처리 (403)
     * - 계정이 BLOCKED 또는 DELETED 상태
     */
    @ExceptionHandler(UserBlockedException.class)
    public ResponseEntity<ApiResponse<Void>> handleUserBlockedException(
            UserBlockedException ex) {
        log.warn("계정 차단됨: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("FORBIDDEN", ex.getMessage()));
    }
    
    /**
     * Validation 예외 처리 (400)
     * - @Valid 검증 실패
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(
            MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining(", "));
        
        log.warn("요청 검증 실패: {}", message);
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("BAD_REQUEST", message));
    }
    
    /**
     * 세션 상태 변경 예외 처리 (409)
     * - 잘못된 상태 전환 시도
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalStateException(
            IllegalStateException ex) {
        log.warn("잘못된 상태 전환 시도: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(ApiResponse.error("CONFLICT", ex.getMessage()));
    }
    
    /**
     * 잘못된 인자 예외 처리 (400)
     * - 유효하지 않은 파라미터
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgumentException(
            IllegalArgumentException ex) {
        log.warn("잘못된 인자: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("BAD_REQUEST", ex.getMessage()));
    }
    
    /**
     * 세션 NotFoundException 처리 (404)
     * - 세션 ID로 조회 실패
     */
    @ExceptionHandler(SessionNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleSessionNotFoundException(
            SessionNotFoundException ex) {
        log.warn("세션을 찾을 수 없음: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error("SESSION_NOT_FOUND", ex.getMessage()));
    }
    
    /**
     * 잘못된 세션 상태 예외 처리 (400)
     * - 비즈니스 규칙 위반 (예: STARTING 아닌 세션에 startBroadcast 호출)
     */
    @ExceptionHandler(InvalidSessionStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleInvalidSessionStateException(
            InvalidSessionStateException ex) {
        log.warn("잘못된 세션 상태: {}", ex.getMessage());
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("INVALID_SESSION_STATE", ex.getMessage()));
    }
    
    /**
     * 일반 예외 처리 (500)
     * - 예상치 못한 서버 오류
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleException(Exception ex) {
        log.error("서버 오류: {}", ex.getMessage(), ex);
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("INTERNAL_ERROR", "서버 오류가 발생했습니다"));
    }
}
