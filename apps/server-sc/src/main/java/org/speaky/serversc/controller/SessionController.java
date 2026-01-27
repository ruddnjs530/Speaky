package org.speaky.serversc.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.domain.SessionStatus;
import org.speaky.serversc.dto.*;
import org.speaky.serversc.service.SessionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 세션 관리 REST API Controller
 * 
 * SessionService를 호출하며, 상태 변경 시 자동으로 WebSocket 이벤트가 발행됨
 */
@Slf4j
@RestController
@RequestMapping("/api/sessions")
@RequiredArgsConstructor
public class SessionController {
    
    private final SessionService sessionService;
    
    /**
     * 세션 생성
     * 
     * POST /api/sessions
     */
    @PostMapping
    public ResponseEntity<SessionResponse> createSession(
            @Valid @RequestBody CreateSessionRequest request) {
        
        log.info("Creating session: hostUserId={}, title={}", 
                request.getHostUserId(), request.getTitle());
        
        var session = sessionService.createSession(
                request.getHostUserId(),
                request.getVoiceModelId(),
                request.getTitle()
        );
        
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(SessionResponse.from(session));
    }
    
    /**
     * 세션 ID로 조회
     * 
     * GET /api/sessions/{sessionId}
     */
    @GetMapping("/{sessionId}")
    public ResponseEntity<SessionResponse> getSession(
            @PathVariable String sessionId) {
        
        return sessionService.getSession(sessionId)
                .map(SessionResponse::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * 호스트 사용자 ID로 세션 목록 조회
     * 
     * GET /api/sessions/host/{hostUserId}
     */
    @GetMapping("/host/{hostUserId}")
    public ResponseEntity<List<SessionResponse>> getSessionsByHost(
            @PathVariable Long hostUserId) {
        
        List<SessionResponse> sessions = sessionService.getSessionsByHostUserId(hostUserId)
                .stream()
                .map(SessionResponse::from)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(sessions);
    }
    
    /**
     * 상태별 세션 목록 조회
     * 
     * GET /api/sessions/status/{status}
     */
    @GetMapping("/status/{status}")
    public ResponseEntity<List<SessionResponse>> getSessionsByStatus(
            @PathVariable SessionStatus status) {
        
        List<SessionResponse> sessions = sessionService.getSessionsByStatus(status)
                .stream()
                .map(SessionResponse::from)
                .collect(Collectors.toList());
        
        return ResponseEntity.ok(sessions);
    }
    
    /**
     * 방송 시작
     * 
     * POST /api/sessions/{sessionId}/start
     */
    @PostMapping("/{sessionId}/start")
    public ResponseEntity<SessionResponse> startBroadcast(
            @PathVariable String sessionId,
            @Valid @RequestBody StartBroadcastRequest request) {
        
        log.info("Starting broadcast: sessionId={}, mediaServerId={}", 
                sessionId, request.getMediaServerId());
        
        return sessionService.startBroadcast(
                        sessionId,
                        request.getMediaServerId(),
                        request.getPipelineId()
                )
                .map(SessionResponse::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * 방송 종료
     * 
     * POST /api/sessions/{sessionId}/end
     */
    @PostMapping("/{sessionId}/end")
    public ResponseEntity<SessionResponse> endBroadcast(
            @PathVariable String sessionId,
            @Valid @RequestBody EndBroadcastRequest request) {
        
        log.info("Ending broadcast: sessionId={}, reason={}", 
                sessionId, request.getReason());
        
        return sessionService.endBroadcast(sessionId, request.getReason())
                .map(SessionResponse::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * 방송 실패 처리
     * 
     * POST /api/sessions/{sessionId}/fail
     */
    @PostMapping("/{sessionId}/fail")
    public ResponseEntity<SessionResponse> failBroadcast(
            @PathVariable String sessionId,
            @Valid @RequestBody EndBroadcastRequest request) {
        
        log.error("Broadcast failed: sessionId={}, reason={}", 
                sessionId, request.getReason());
        
        return sessionService.failBroadcast(sessionId, request.getReason())
                .map(SessionResponse::from)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    /**
     * 세션 삭제
     * 
     * DELETE /api/sessions/{sessionId}
     */
    @DeleteMapping("/{sessionId}")
    public ResponseEntity<Void> deleteSession(@PathVariable String sessionId) {
        
        log.info("Deleting session: sessionId={}", sessionId);
        
        sessionService.deleteSession(sessionId);
        return ResponseEntity.noContent().build();
    }
}
