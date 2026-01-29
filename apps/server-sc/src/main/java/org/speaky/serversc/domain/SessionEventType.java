package org.speaky.serversc.domain;

/**
 * WebSocket 이벤트 타입
 * 
 * 프로젝트 공통 Envelope 규약에 따라 SYS_* prefix 사용
 * SYS_*: 시스템 이벤트 (세션 상태 변경)
 * SIG_*: WebRTC 시그널링 (프론트엔드 팀 구현 예정)
 */
public enum SessionEventType {
    /**
     * 세션 생성됨
     * SessionService.createSession() 호출 시 발생
     */
    SYS_SESSION_CREATED,
    
    /**
     * 방송 시작됨 (STARTING → LIVE)
     * SessionService.startBroadcast() 호출 시 발생
     */
    SYS_SESSION_STARTED,
    
    /**
     * 방송 종료됨 (LIVE → ENDED)
     * SessionService.endBroadcast() 호출 시 발생
     */
    SYS_SESSION_ENDED,
    
    /**
     * 방송 실패함 (ANY → FAILED)
     * SessionService.failBroadcast() 호출 시 발생
     */
    SYS_SESSION_FAILED,
    
    /**
     * 세션 정보 업데이트됨
     * 세션 메타데이터 변경 시 발생
     */
    SYS_SESSION_UPDATED
}

