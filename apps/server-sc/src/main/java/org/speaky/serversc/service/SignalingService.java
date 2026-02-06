package org.speaky.serversc.service;

import org.speaky.serversc.client.MediaServerClient;
import org.speaky.serversc.exception.MediaServerException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.domain.SessionEntity;
import org.speaky.serversc.domain.SessionStatus;
import org.speaky.serversc.dto.Envelope;
import org.speaky.serversc.dto.From;
import org.speaky.serversc.exception.SessionNotFoundException;
import org.speaky.serversc.repository.SessionRepository;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Map;

/**
 * WebSocket 시그널링 처리 서비스
 * 
 * 클라이언트 메시지 수신 후 처리 로직
 * WebSocket 연결 해제 시 미디어 서버 정리
 * 
 * 현재 구현:
 * - SYS_ATTACH: 세션 바인딩
 * - SIG_OFFER/ANSWER/ICE: Media Server 연동
 * - WebSocket Disconnect: leaveRoom 호출
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
        private final MediaServerClient mediaServerClient;

        // Channel ID -> Set of Client IDs
        private final java.util.Map<String, java.util.Set<String>> channelViewers = new java.util.concurrent.ConcurrentHashMap<>();

        /**
         * STOMP 구독 이벤트 처리
         * - 시청자 수 집계 및 브로드캐스트
         */
        @EventListener
        public void handleSubscribeEvent(org.springframework.web.socket.messaging.SessionSubscribeEvent event) {
                SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.wrap(event.getMessage());
                String destination = accessor.getDestination();

                // /topic/channel/{channelId} 구독 감지
                if (destination != null && destination.startsWith("/topic/channel/")) {
                        String channelId = destination.replace("/topic/channel/", "");
                        String sessionId = accessor.getSessionId(); // Use WebSocket Session ID

                        if (sessionId != null) {
                                addViewer(channelId, sessionId);
                        }
                }
        }

        private void addViewer(String channelId, String sessionId) {
                channelViewers.computeIfAbsent(channelId, k -> java.util.concurrent.ConcurrentHashMap.newKeySet())
                                .add(sessionId);
                broadcastViewerCount(channelId);
        }

        private void removeViewer(String sessionId) {
                java.util.Set<String> affectedChannels = new java.util.HashSet<>();

                channelViewers.forEach((channelId, viewers) -> {
                        if (viewers.remove(sessionId)) {
                                affectedChannels.add(channelId);
                        }
                });

                affectedChannels.forEach(this::broadcastViewerCount);
        }

        private void broadcastViewerCount(String channelId) {
                java.util.Set<String> viewers = channelViewers.get(channelId);
                // Host is included in the set, so subtract 1 to get "viewers only" count
                int totalConnections = (viewers != null) ? viewers.size() : 0;
                int count = Math.max(0, totalConnections - 1);

                Envelope countMessage = Envelope.builder()
                                .v(PROTOCOL_VERSION)
                                .type("SYS_VIEWER_COUNT")
                                .requestId(java.util.UUID.randomUUID().toString())
                                .ts(System.currentTimeMillis())
                                .channelId(channelId)
                                .sessionId(channelId) // Use channelId as sessionId for system messages
                                .from(From.builder().role(SERVER_ROLE).clientId(SERVER_CLIENT_ID).build())
                                .payload(java.util.Map.of("count", count))
                                .build();

                messagingTemplate.convertAndSend("/topic/channel/" + channelId, countMessage);
                log.debug("Broadcast viewer count: channel={}, count={}", channelId, count);
        }
        
    
    /**
     * SYS_ATTACH 처리: 세션에 클라이언트 바인딩
     * 
     * 검증:
     * - 세션 존재 여부
     * - 세션 상태 (LIVE만 허용)
     * 
     * 응답: SYS_ACK
     * 
     * @param envelope 클라이언트 메시지
     * @param headerAccessor WebSocket 세션 정보
     */
    public void handleAttach(Envelope envelope, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = envelope.getSessionId();
        
        // 세션 존재 여부 확인
        SessionEntity session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
        
        // 세션 상태 확인 (STARTING 또는 LIVE 허용 - 호스트 미리보기를 위해 STARTING도 허용)
        if (session.getStatus() != SessionStatus.LIVE && session.getStatus() != SessionStatus.STARTING) {
            sendError(envelope, "INVALID_STATE", 
                    "Session is not active: " + session.getStatus());
            return;
        }
        
        // WebSocket 세션에 사용자 정보 저장
        String clientId = envelope.getFrom().getClientId();
        headerAccessor.getSessionAttributes().put("clientId", clientId);
        headerAccessor.getSessionAttributes().put("sessionId", sessionId);
        headerAccessor.getSessionAttributes().put("role", envelope.getFrom().getRole());
        
        // SYS_ACK 응답 (프론트엔드 protocol.ts 규격)
        Envelope response = Envelope.builder()
                .v(PROTOCOL_VERSION)
                .type("SYS_ACK")
                .requestId(envelope.getRequestId())
                .ts(System.currentTimeMillis())
                .channelId(envelope.getChannelId())
                .sessionId(sessionId)
                .from(From.builder()
                        .role(SERVER_ROLE)
                        .clientId(SERVER_CLIENT_ID)
                        .build())
                .payload(Map.of("status", "OK"))
                .build();
        
        String destination = "/topic/channel/" + envelope.getChannelId();
        messagingTemplate.convertAndSend(destination, response);
        
        log.info("Client attached: sessionId={}, clientId={}, role={}", 
                sessionId, clientId, envelope.getFrom().getRole());
    }
    
    /**
     * SIG_OFFER 처리: SDP Offer 수신 및 Media Server 전달
     * 
     * @param envelope SDP Offer 메시지
     * @param headerAccessor WebSocket 세션 정보 (인증된 사용자 ID 포함)
     */
    @SuppressWarnings("unchecked")
    public void handleOffer(Envelope envelope, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = envelope.getSessionId();
        String clientId = envelope.getFrom().getClientId(); // WebSocket clientId
        Map<String, Object> payload = (Map<String, Object>) envelope.getPayload();
        String sdpOffer = (String) payload.get("sdp");
        
        log.info("Received SDP Offer: sessionId={}, clientId={}", sessionId, clientId);
        
        try {
            // Retrieve session to get hostUserId
            SessionEntity session = sessionRepository.findById(sessionId)
                    .orElseThrow(() -> new SessionNotFoundException(sessionId));
            
            // SECURITY FIX: JWT 인증된 userId로 권한 검증
            Long authUserId = (Long) headerAccessor.getSessionAttributes().get("userId");
            String userId;

            // 인증된 사용자가 호스트인지 확인
            if (authUserId != null && authUserId.equals(session.getHostUserId())) {
                userId = String.valueOf(authUserId); // HOST
            } else {
                userId = clientId; // GUEST/VIEWER (WebSocket clientId 사용)
            }
            
            // Media Server에 Join 요청 (SDP Offer 전달 및 Answer 수신)
            String sdpAnswer = mediaServerClient.joinRoom(sessionId, userId, sdpOffer);
            
            // SIG_ANSWER 응답 생성
            Envelope response = Envelope.builder()
                    .v(PROTOCOL_VERSION)
                    .type("SIG_ANSWER")
                    .requestId(envelope.getRequestId()) // 요청 ID 유지
                    .ts(System.currentTimeMillis())
                    .channelId(envelope.getChannelId())
                    .sessionId(sessionId)
                    .from(From.builder()
                            .role(SERVER_ROLE)
                            .clientId(SERVER_CLIENT_ID) 
                            .build())
                    .payload(Map.of(
                            "sdpType", "answer",
                            "sdp", sdpAnswer
                    ))
                    .build();
            
            // 특정 채널 subscriber에게 전송
            String destination = "/topic/channel/" + envelope.getChannelId();
            messagingTemplate.convertAndSend(destination, response);
            
            log.info("Sent SIG_ANSWER: sessionId={}", sessionId);
            
        } catch (Exception e) {
            log.error("Failed to handle SDP Offer: {}", e.getMessage(), e);
            sendError(envelope, "SYS_ERROR", "Media Server Error: " + e.getMessage());
        }
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
     * @param envelope ICE Candidate 메시지
     * @param headerAccessor WebSocket 세션 정보 (인증된 사용자 ID 포함)
     */
    @SuppressWarnings("unchecked")
    public void handleIce(Envelope envelope, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = envelope.getSessionId();
        String clientId = envelope.getFrom().getClientId(); // WebSocket clientId
        Map<String, Object> payload = (Map<String, Object>) envelope.getPayload();
        
        String candidate = (String) payload.get("candidate");
        String sdpMid = (String) payload.get("sdpMid");
        Integer sdpMLineIndex = (Integer) payload.get("sdpMLineIndex");
        
        log.debug("Received ICE Candidate: sessionId={}, clientId={}, sdpMid={}", 
                sessionId, clientId, sdpMid);
        
        try {
            // Retrieve session to get hostUserId
            SessionEntity session = sessionRepository.findById(sessionId)
                    .orElseThrow(() -> new SessionNotFoundException(sessionId));
            
            // SECURITY FIX: JWT 인증된 userId로 권한 검증
            Long authUserId = (Long) headerAccessor.getSessionAttributes().get("userId");
            String userId;

            if (authUserId != null && authUserId.equals(session.getHostUserId())) {
                userId = String.valueOf(authUserId); // HOST
            } else {
                userId = clientId; // GUEST/VIEWER
            }
            
            if (candidate != null && sdpMLineIndex != null) {
                mediaServerClient.submitIceCandidate(
                        sessionId, 
                        userId, 
                        candidate, 
                        sdpMid, 
                        sdpMLineIndex
                );
            } else {
                log.warn("Invalid ICE Candidate payload: {}", payload);
            }
        } catch (Exception e) {
            log.error("Failed to submit ICE Candidate: {}", e.getMessage());
            // ICE 실패는 치명적이지 않으므로 클라이언트에 에러 리턴하지 않음 (로그만 남김)
        }
    }
    
    /**
     * 에러 응답 전송
     * 
     * @param originalEnvelope 원본 메시지
     * @param errorCode 에러 코드
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
        
        String destination = "/topic/channel/" + originalEnvelope.getChannelId();
        messagingTemplate.convertAndSend(destination, errorResponse);
        
        log.warn("Sent error: sessionId={}, code={}, message={}",
                originalEnvelope.getSessionId(), errorCode, errorMessage);
    }
}
