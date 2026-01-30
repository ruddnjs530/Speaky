package org.speaky.serversc.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.domain.SessionEntity;
import org.speaky.serversc.domain.SessionStatus;
import org.speaky.serversc.dto.ChannelStateResponse;
import org.speaky.serversc.repository.SessionRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

/**
 * 채널 관리 REST API Controller
 * 
 * 채널의 현재 방송 상태를 조회하는 API 제공
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/channels")
@RequiredArgsConstructor
public class ChannelController {
    
    private final SessionRepository sessionRepository;
    
    /**
     * 채널 상태 조회
     * 
     * GET /api/v1/channels/{channelId}/state
     * 
     * @param channelId 채널 ID (예: "ch_user_faker")
     * @return 채널 상태 정보 (호스트 로그인 ID, 활성 세션 ID)
     */
    @GetMapping("/{channelId}/state")
    public ResponseEntity<ChannelStateResponse> getChannelState(
            @PathVariable String channelId) {
        
        log.info("Getting channel state: channelId={}", channelId);
        
        // LIVE 상태인 세션 조회
        Optional<SessionEntity> liveSession = sessionRepository.findByChannelIdAndStatus(
                channelId, 
                SessionStatus.LIVE
        );
        
        // TODO: hostLoginId는 User 서비스에서 조회해야 함
        // 현재는 channelId에서 추출 (임시)
        String hostLoginId = extractHostLoginIdFromChannelId(channelId);
        
        ChannelStateResponse response = ChannelStateResponse.builder()
                .hostLoginId(hostLoginId)
                .activeSessionId(liveSession.map(SessionEntity::getSessionId).orElse(null))
                .build();
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * 채널 ID에서 호스트 로그인 ID 추출 (임시 구현)
     * 
     * 예: "ch_user_faker" -> "faker"
     * 
     * TODO: User 서비스 연동 후 제거
     */
    private String extractHostLoginIdFromChannelId(String channelId) {
        if (channelId != null && channelId.startsWith("ch_user_")) {
            return channelId.substring("ch_user_".length());
        }
        return channelId;
    }
}
