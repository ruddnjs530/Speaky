package org.speaky.serversc.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * WebSocket 세션(방송 세션)의 도메인 엔티티
 * ERD stream_sessions 테이블 기준으로 설계
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionEntity {
    
    /**
     * 세션 ID (Primary Key)
     * ERD: session_id UUID
     */
    private String sessionId;
    
    /**
     * 호스트(방송자) 사용자 ID
     * ERD: host_user_id BIGINT NOT NULL
     */
    private Long hostUserId;
    
    /**
     * 음성 모델 ID
     * ERD: voice_model_id BIGINT NOT NULL
     */
    private Long voiceModelId;
    
    /**
     * 방송 제목
     * ERD: title VARCHAR(50) NOT NULL
     */
    private String title;
    
    /**
     * 세션 상태: STARTING, LIVE, ENDED, FAILED
     * ERD: status ENUM('STARTING','LIVE','ENDED','FAILED') NOT NULL
     */
    private SessionStatus status;
    
    /**
     * 방송 시작 시간
     * ERD: started_at TIMESTAMP NULL
     */
    private LocalDateTime startedAt;
    
    /**
     * 방송 종료 시간
     * ERD: ended_at TIMESTAMP NULL
     */
    private LocalDateTime endedAt;
    
    /**
     * 종료 사유
     * ERD: ended_reason VARCHAR(255) NULL
     */
    private String endedReason;
    
    /**
     * 미디어 서버 ID
     * ERD: media_server_id VARCHAR(100) NULL
     */
    private String mediaServerId;
    
    /**
     * 파이프라인 ID
     * ERD: pipeline_id VARCHAR(120) NULL
     */
    private String pipelineId;
    
    /**
     * 생성 시간
     * ERD: created_at TIMESTAMP NOT NULL
     */
    private LocalDateTime createdAt;
}
