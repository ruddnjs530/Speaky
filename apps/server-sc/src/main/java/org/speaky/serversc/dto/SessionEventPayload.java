package org.speaky.serversc.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.speaky.serversc.domain.SessionEntity;
import org.speaky.serversc.domain.SessionEventType;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * WebSocket 이벤트 페이로드
 * 
 * 세션 상태 변경 시 클라이언트에게 전송되는 이벤트 데이터
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionEventPayload {
    
    /**
     * 이벤트 타입
     */
    private SessionEventType eventType;
    
    /**
     * 세션 ID
     */
    private String sessionId;
    
    /**
     * 이벤트 발생 시간
     */
    private LocalDateTime timestamp;
    
    /**
     * 세션 현재 상태 데이터
     */
    private SessionEntity sessionData;
    
    /**
     * 추가 메타데이터 (선택적)
     * 예: {"reason": "User requested", "duration": "3600"}
     */
    private Map<String, Object> metadata;
}
