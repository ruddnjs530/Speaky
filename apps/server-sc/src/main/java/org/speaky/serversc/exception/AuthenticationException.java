package org.speaky.serversc.exception;

/**
 * 인증 실패 예외
 * - 사용자 없음
 * - 비밀번호 불일치
 */
public class AuthenticationException extends RuntimeException {
    
    public AuthenticationException(String message) {
        super(message);
    }
    
    public AuthenticationException(String message, Throwable cause) {
        super(message, cause);
    }
}
