package org.speaky.serversc.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 방송 종료 요청 DTO
 */
@Data
public class EndBroadcastRequest {
    
    /**
     * 종료/실패 사유
     */
    @NotBlank(message = "Reason is required")
    private String reason;
}
