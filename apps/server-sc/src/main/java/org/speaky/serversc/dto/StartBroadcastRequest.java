package org.speaky.serversc.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 방송 시작 요청 DTO
 */
@Data
public class StartBroadcastRequest {
    
    /**
     * 미디어 서버 ID
     */
    @NotBlank(message = "Media server ID is required")
    private String mediaServerId;
    
    /**
     * 파이프라인 ID
     */
    @NotBlank(message = "Pipeline ID is required")
    private String pipelineId;
}
