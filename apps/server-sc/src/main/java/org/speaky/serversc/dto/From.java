package org.speaky.serversc.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * WebSocket 메시지 발신자 정보
 * 
 * Envelope 스키마의 from 필드에 사용
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class From {
    
    /**
     * 발신자 역할
     * HOST (방송자), GUEST (시청자), SC (서버)
     */
    private String role;
    
    /**
     * 클라이언트 식별자
     * 클라이언트가 생성한 탭/디바이스 단위 UUID
     * 서버에서는 "server" 사용
     */
    private String clientId;
}
