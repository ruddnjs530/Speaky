package org.speaky.serversc.exception;

/**
 * 계정 차단/삭제 예외
 * - 계정이 BLOCKED 또는 DELETED 상태일 때
 */
public class UserBlockedException extends RuntimeException {
    
    public UserBlockedException(String message) {
        super(message);
    }
    
    public UserBlockedException(String message, Throwable cause) {
        super(message, cause);
    }
}
