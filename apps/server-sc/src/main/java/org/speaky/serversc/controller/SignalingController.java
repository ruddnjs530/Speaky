package org.speaky.serversc.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.dto.Envelope;
import org.speaky.serversc.service.SignalingService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

/**
 * WebSocket 메시지 수신 컨트롤러
 * 
 * 클라이언트→서버 메시지 처리
 * 
 * 경로: /app/signaling
 * 
 * 지원하는 메시지 타입:
 * - SYS_ATTACH: 세션 바인딩
 * - SIG_OFFER: SDP Offer 수신
 * - SIG_ANSWER: SDP Answer 응답
 * - SIG_ICE: ICE Candidate 중계
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class SignalingController {
    
    private final SignalingService signalingService;
    
    /**
     * 클라이언트 메시지 통합 핸들러
     * 
     * Envelope.type 필드로 분기 처리
     * 모든 에러는 SYS_ERROR로 응답
     * 
     * @param envelope 클라이언트 메시지 (Envelope 형식)
     * @param headerAccessor WebSocket 세션 정보
     */
    @MessageMapping("/signaling")
    public void handleMessage(
            @Payload Envelope envelope,
            SimpMessageHeaderAccessor headerAccessor
    ) {
        String type = envelope.getType();
        String sessionId = envelope.getSessionId();
        String requestId = envelope.getRequestId();
        
        log.info("Received message: type={}, sessionId={}, requestId={}", 
                type, sessionId, requestId);
        
        try {
            switch (type) {
                case "SYS_ATTACH":
                    signalingService.handleAttach(envelope, headerAccessor);
                    break;
                case "SIG_OFFER":
                    signalingService.handleOffer(envelope);
                    break;
                case "SIG_ANSWER":
                    signalingService.handleAnswer(envelope);
                    break;
                case "SIG_ICE":
                    signalingService.handleIce(envelope);
                    break;
                default:
                    signalingService.sendError(envelope, "UNKNOWN_TYPE", 
                            "Unknown message type: " + type);
            }
        } catch (Exception e) {
            log.error("Error handling message: type={}, sessionId={}, error={}", 
                    type, sessionId, e.getMessage(), e);
            signalingService.sendError(envelope, "INTERNAL_ERROR", e.getMessage());
        }
    }
}
