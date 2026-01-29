package org.speaky.serversc.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.domain.SessionEntity;
import org.speaky.serversc.domain.SessionStatus;
import org.speaky.serversc.dto.Envelope;
import org.speaky.serversc.dto.From;
import org.speaky.serversc.exception.SessionNotFoundException;
import org.speaky.serversc.repository.SessionRepository;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

/**
 * WebSocket 시그널링 처리 서비스
 * 
 * 클라이언트 메시지 수신 후 처리 로직
 * 
 * 현재 구현:
 * - SYS_ATTACH: 세션 바인딩
 * - SIG_OFFER/ANSWER/ICE: Mock 응답 (Media Server 연동 전)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SignalingService {
    
    private static final int PROTOCOL_VERSION = 1;
    private static final String SERVER_ROLE = "SC";
    private static final String SERVER_CLIENT_ID = "server";
    
    private final SessionRepository sessionRepository;
    private final SimpMessagingTemplate messagingTemplate;
    
    /**
     * SYS_ATTACH 처리: 세션에 클라이언트 바인딩
     * 
     * 검증:
     * - 세션 존재 여부
     * - 세션 상태 (LIVE만 허용)
     * 
     * 응답: SYS_ATTACHED
     * 
     * @param envelope 클라이언트 메시지
     * @param headerAccessor WebSocket 세션 정보
     */
    public void handleAttach(Envelope envelope, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = envelope.getSessionId();
        
        // 세션 존재 여부 확인
        SessionEntity session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
        
        // 세션 상태 확인 (LIVE만 허용)
        if (session.getStatus() != SessionStatus.LIVE) {
            sendError(envelope, "INVALID_STATE", 
                    "Session is not LIVE: " + session.getStatus());
            return;
        }
        
        // WebSocket 세션에 사용자 정보 저장
        String clientId = envelope.getFrom().getClientId();
        headerAccessor.getSessionAttributes().put("clientId", clientId);
        headerAccessor.getSessionAttributes().put("sessionId", sessionId);
        headerAccessor.getSessionAttributes().put("role", envelope.getFrom().getRole());
        
        // SYS_ATTACHED 응답
        Envelope response = Envelope.builder()
                .v(PROTOCOL_VERSION)
                .type("SYS_ATTACHED")
                .requestId(envelope.getRequestId())
                .ts(System.currentTimeMillis())
                .channelId(envelope.getChannelId())
                .sessionId(sessionId)
                .from(From.builder()
                        .role(SERVER_ROLE)
                        .clientId(SERVER_CLIENT_ID)
                        .build())
                .payload(Map.of(
                        "sessionId", session.getSessionId(),
                        "status", session.getStatus().name(),
                        "title", session.getTitle()
                ))
                .build();
        
        String destination = "/topic/session/" + sessionId;
        messagingTemplate.convertAndSend(destination, response);
        
        log.info("Client attached: sessionId={}, clientId={}, role={}", 
                sessionId, clientId, envelope.getFrom().getRole());
    }
    
    /**
     * SIG_OFFER 처리: SDP Offer 수신 및 Media Server 전달
     * 
     * TODO: Media Server gRPC 호출
     * 현재: Mock SIG_ANSWER 응답
     * 
     * @param envelope SDP Offer 메시지
     */
    public void handleOffer(Envelope envelope) {
        // TODO: Media Server gRPC 호출
        log.info("Received SDP Offer: sessionId={}, payload={}", 
                envelope.getSessionId(), envelope.getPayload());
        
        // Mock SIG_ANSWER 응답 (Media Server 연동 전)
        Envelope response = Envelope.builder()
                .v(PROTOCOL_VERSION)
                .type("SIG_ANSWER")
                .requestId(UUID.randomUUID().toString())
                .ts(System.currentTimeMillis())
                .channelId(envelope.getChannelId())
                .sessionId(envelope.getSessionId())
                .from(From.builder()
                        .role(SERVER_ROLE)
                        .clientId(SERVER_CLIENT_ID)
                        .build())
                .payload(Map.of(
                        "sdpType", "answer",
                        "sdp", "mock-sdp-answer"  // TODO: 실제 Media Server 응답
                ))
                .build();
        
        String destination = "/topic/session/" + envelope.getSessionId();
        messagingTemplate.convertAndSend(destination, response);
        
        log.info("Sent mock SIG_ANSWER: sessionId={}", envelope.getSessionId());
    }
    
    /**
     * SIG_ANSWER 처리: SDP Answer Media Server 전달
     * 
     * TODO: Media Server gRPC 호출
     * 
     * @param envelope SDP Answer 메시지
     */
    public void handleAnswer(Envelope envelope) {
        // TODO: Media Server gRPC 호출
        log.info("Received SDP Answer: sessionId={}, payload={}", 
                envelope.getSessionId(), envelope.getPayload());
    }
    
    /**
     * SIG_ICE 처리: ICE Candidate Media Server 전달
     * 
     * TODO: Media Server gRPC 호출
     * 
     * @param envelope ICE Candidate 메시지
     */
    public void handleIce(Envelope envelope) {
        // TODO: Media Server gRPC 호출
        log.info("Received ICE Candidate: sessionId={}, payload={}", 
                envelope.getSessionId(), envelope.getPayload());
    }
    
    /**
     * SYS_ERROR 응답 전송
     * 
     * 모든 에러는 SYS_ERROR Envelope로 응답
     * 
     * @param originalEnvelope 원본 메시지
     * @param errorCode 에러 코드 (INVALID_STATE, UNKNOWN_TYPE 등)
     * @param errorMessage 에러 메시지
     */
    public void sendError(Envelope originalEnvelope, String errorCode, String errorMessage) {
        Envelope errorResponse = Envelope.builder()
                .v(PROTOCOL_VERSION)
                .type("SYS_ERROR")
                .requestId(originalEnvelope.getRequestId())
                .ts(System.currentTimeMillis())
                .sessionId(originalEnvelope.getSessionId())
                .from(From.builder()
                        .role(SERVER_ROLE)
                        .clientId(SERVER_CLIENT_ID)
                        .build())
                .payload(Map.of(
                        "code", errorCode,
                        "message", errorMessage
                ))
                .build();
        
        String destination = "/topic/session/" + originalEnvelope.getSessionId();
        messagingTemplate.convertAndSend(destination, errorResponse);
        
        log.warn("Sent error: sessionId={}, code={}, message={}", 
                originalEnvelope.getSessionId(), errorCode, errorMessage);
    }
}
