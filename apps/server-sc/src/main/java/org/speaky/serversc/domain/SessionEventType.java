package org.speaky.serversc.domain;

/**
 * WebSocket 이벤트 타입
 * 
 * 방송 세션의 상태 변경 및 중요 이벤트를 알리기 위한 이벤트 타입 정의
 */
public enum SessionEventType {
    /**
     * 세션 생성됨
     * SessionService.createSession() 호출 시 발생
     */
    SESSION_CREATED,
    
    /**
     * 방송 시작됨 (STARTING → LIVE)
     * SessionService.startBroadcast() 호출 시 발생
     */
    SESSION_STARTED,
    
    /**
     * 방송 종료됨 (LIVE → ENDED)
     * SessionService.endBroadcast() 호출 시 발생
     */
    SESSION_ENDED,
    
    /**
     * 방송 실패함 (ANY → FAILED)
     * SessionService.failBroadcast() 호출 시 발생
     */
    SESSION_FAILED,
    
    /**
     * 세션 정보 업데이트됨
     * 세션 메타데이터 변경 시 발생
     */
    SESSION_UPDATED
}
