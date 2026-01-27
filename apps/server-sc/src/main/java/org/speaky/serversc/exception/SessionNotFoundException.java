package org.speaky.serversc.exception;

/**
 * 세션을 찾을 수 없을 때 발생하는 예외
 * 
 * GlobalExceptionHandler에서 404 Not Found로 처리됨
 */
public class SessionNotFoundException extends RuntimeException {
    
    private final String sessionId;
    
    public SessionNotFoundException(String sessionId) {
        super(String.format("Session not found: %s", sessionId));
        this.sessionId = sessionId;
    }
    
    public String getSessionId() {
        return sessionId;
    }
}
