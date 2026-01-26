package org.speaky.serversc.domain;

/**
 * WebSocket 세션의 상태를 나타내는 Enum (ERD 기준)
 * 
 * - STARTING: 방송 시작 중
 * - LIVE: 방송 진행 중
 * - ENDED: 방송 종료
 * - FAILED: 방송 실패
 */
public enum SessionStatus {
    /**
     * 방송 시작 중
     */
    STARTING,
    
    /**
     * 방송 진행 중
     */
    LIVE,
    
    /**
     * 방송 종료
     */
    ENDED,
    
    /**
     * 방송 실패
     */
    FAILED
}
