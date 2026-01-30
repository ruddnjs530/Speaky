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
     * TODO: JWT에서 추출하도록 변경 예정 (현재는 호환성을 위해 유지)
     */
    @NotNull(message = "Host user ID is required")
    private Long hostUserId;
    
    /**
     * 채널 ID (Optional - 서버에서 자동 생성 가능)
     * 예: "ch_user_faker"
     */
    private String channelId;
    
    /**
     * 음성 모델 ID (Optional)
     * 프론트엔드 스펙: voiceModelID
     */
    private Long voiceModelID;
    
    /**
     * 방송 제목
     */
    @NotBlank(message = "Title is required")
    @Size(max = 50, message = "Title must be less than 50 characters")
    private String title;
}
