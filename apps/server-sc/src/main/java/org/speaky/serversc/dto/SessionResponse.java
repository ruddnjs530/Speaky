package org.speaky.serversc.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.speaky.serversc.domain.SessionEntity;
import org.speaky.serversc.domain.SessionStatus;

import java.time.LocalDateTime;

/**
 * 세션 응답 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionResponse {
    
    private String sessionId;
    private Long hostUserId;
    private Long voiceModelId;
    private String title;
    private SessionStatus status;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;
    private String endedReason;
    private String mediaServerId;
    private String pipelineId;
    private LocalDateTime createdAt;
    
    /**
     * SessionEntity를 SessionResponse로 변환
     */
    public static SessionResponse from(SessionEntity entity) {
        return SessionResponse.builder()
                .sessionId(entity.getSessionId())
                .hostUserId(entity.getHostUserId())
                .voiceModelId(entity.getVoiceModelId())
                .title(entity.getTitle())
                .status(entity.getStatus())
                .startedAt(entity.getStartedAt())
                .endedAt(entity.getEndedAt())
                .endedReason(entity.getEndedReason())
                .mediaServerId(entity.getMediaServerId())
                .pipelineId(entity.getPipelineId())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
