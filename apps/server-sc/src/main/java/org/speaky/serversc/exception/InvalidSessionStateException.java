package org.speaky.serversc.exception;

/**
 * 세션 상태 전환이 유효하지 않을 때 발생하는 예외
 * 
 * 예: STARTING 상태가 아닌 세션에 startBroadcast() 호출
 * GlobalExceptionHandler에서 400 Bad Request로 처리됨
 */
public class InvalidSessionStateException extends RuntimeException {
    
    private final String sessionId;
    private final String currentState;
    private final String expectedState;
    
    public InvalidSessionStateException(String sessionId, String currentState, String expectedState) {
        super(String.format("Invalid session state: session=%s, current=%s, expected=%s", 
                sessionId, currentState, expectedState));
        this.sessionId = sessionId;
        this.currentState = currentState;
        this.expectedState = expectedState;
    }
    
    public String getSessionId() {
        return sessionId;
    }
    
    public String getCurrentState() {
        return currentState;
    }
    
    public String getExpectedState() {
        return expectedState;
    }
}
