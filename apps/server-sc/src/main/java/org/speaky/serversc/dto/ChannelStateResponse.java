package org.speaky.serversc.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 채널 상태 응답 DTO
 * 
 * 프론트엔드가 특정 채널의 현재 방송 상태를 조회할 때 사용
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChannelStateResponse {
    
    /**
     * 채널 호스트의 로그인 ID
     */
    private String hostLoginId;
    
    /**
     * 현재 활성(LIVE) 세션 ID
     * null이면 방송 중이 아님
     */
    private String activeSessionId;
}
