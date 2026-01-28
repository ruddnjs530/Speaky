package org.speaky.serversc.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * WebSocket 공통 Envelope 스키마
 * 
 * 프로젝트 공통 규약에 따른 메시지 래퍼
 * 모든 WebSocket 메시지는 이 형식으로 송수신
 * 
 * @see docs/BE/SC/Client-통신.md - 5. 공통 Envelope 스키마
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Envelope {
    
    /**
     * 프로토콜 버전
     * 현재 버전: 1
     */
    private Integer v;
    
    /**
     * 이벤트 타입
     * SYS_* (시스템 이벤트) 또는 SIG_* (시그널링)
     */
    private String type;
    
    /**
     * 메시지 단위 상관관계 ID
     * 매 메시지마다 새로 생성 (UUID)
     */
    private String requestId;
    
    /**
     * 메시지 전송 시각 (Unix timestamp, ms)
     */
    private Long ts;
    
    /**
     * 채널 식별자 (상시 존재)
     * 예: "ch_user_faker"
     */
    private String channelId;
    
    /**
     * 세션 식별자 (방송 인스턴스)
     * 예: "sess_789"
     */
    private String sessionId;
    
    /**
     * 발신자 정보
     */
    private From from;
    
    /**
     * 이벤트별 데이터
     */
    private Object payload;
}
