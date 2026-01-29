package org.speaky.serversc.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 세션 생성 요청 DTO
 */
@Data
public class CreateSessionRequest {
    
    /**
     * 호스트(방송자) 사용자 ID
     */
    @NotNull(message = "Host user ID is required")
    private Long hostUserId;
    
    /**
     * 채널 ID (필수)
     * 예: "ch_user_faker"
     */
    @NotBlank(message = "Channel ID is required")
    private String channelId;
    
    /**
     * 음성 모델 ID
     */
    @NotNull(message = "Voice model ID is required")
    private Long voiceModelId;
    
    /**
     * 방송 제목
     */
    @NotBlank(message = "Title is required")
    @Size(max = 50, message = "Title must be less than 50 characters")
    private String title;
}
