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

        /**
         * WebSocket 연결 해제 이벤트 처리
         * 
         * 클라이언트가 연결을 끊을 때 미디어 서버에 leaveRoom 호출
         * 
         * @param event SessionDisconnectEvent
         */
        @EventListener
        public void handleWebSocketDisconnect(SessionDisconnectEvent event) {
                SimpMessageHeaderAccessor headerAccessor = SimpMessageHeaderAccessor.wrap(event.getMessage());

                Map<String, Object> sessionAttributes = headerAccessor.getSessionAttributes();
                if (sessionAttributes == null) {
                        return;
                }

                String sessionId = (String) sessionAttributes.get("sessionId");
                String clientId = (String) sessionAttributes.get("clientId");

                if (sessionId == null || clientId == null) {
                        log.debug("WebSocket disconnect without session binding: sessionAttributes={}",
                                        sessionAttributes);
                        return;
                }

                log.info("WebSocket disconnected: sessionId={}, clientId={}", sessionId, clientId);

                // Media Server에 leaveRoom 호출
                try {
                        mediaServerClient.leaveRoom(sessionId, clientId);
                        log.info("Media server leaveRoom success: sessionId={}, clientId={}",
                                        sessionId, clientId);
                } catch (MediaServerException e) {
                        // leaveRoom 실패는 비치명적 - 로깅하고 계속 진행
                        // 클라이언트는 이미 연결이 끊긴 상태이므로 재시도 불가
                        log.warn("Failed to leave media server room: sessionId={}, clientId={}, errorCode={}",
                                        sessionId, clientId, e.getErrorCode(), e);

                        // TODO: 주기적인 cleanup 배치 작업에서 처리
                        // - 미디어 서버의 고아 참가자 목록 조회 및 정리
                }
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
         * @param envelope       클라이언트 메시지
         * @param headerAccessor WebSocket 세션 정보
         */
        public void handleAttach(Envelope envelope, SimpMessageHeaderAccessor headerAccessor) {
                String sessionId = envelope.getSessionId();

                // 세션 존재 여부 확인
                SessionEntity session = sessionRepository.findById(sessionId)
                                .orElseThrow(() -> new SessionNotFoundException(sessionId));

                // 세션 상태 확인
                // HOST는 방송 시작 전(STARTING)에도 접속하여 미리보기를 봐야 하므로 허용
                // GUEST는 방송 중(LIVE)일 때만 접속 허용
                String role = envelope.getFrom().getRole();
                SessionStatus status = session.getStatus();

                if ("HOST".equalsIgnoreCase(role)) {
                        // Host는 STARTING, LIVE 모두 허용
                        if (status != SessionStatus.STARTING && status != SessionStatus.LIVE) {
                                sendError(envelope, "INVALID_STATE",
                                                "Host cannot attach in state: " + status);
                                return;
                        }
                } else {
                        // Guest는 LIVE만 허용
                        if (status != SessionStatus.LIVE) {
                                sendError(envelope, "INVALID_STATE",
                                                "Session is not LIVE: " + status);
                                return;
                        }
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
         * TODO: Media Server gRPC 호출
         * 현재: Mock SIG_ANSWER 응답
         * 
         * @param envelope SDP Offer 메시지
         */
        @SuppressWarnings("unchecked")
        public void handleOffer(Envelope envelope) {
                String sessionId = envelope.getSessionId();
                String clientId = envelope.getFrom().getClientId();
                Map<String, Object> payload = (Map<String, Object>) envelope.getPayload();
                String sdpOffer = (String) payload.get("sdp");

                log.info("Received SDP Offer: sessionId={}, clientId={}", sessionId, clientId);

                try {
                        // Retrieve session to get hostUserId
                        SessionEntity session = sessionRepository.findById(sessionId)
                                        .orElseThrow(() -> new SessionNotFoundException(sessionId));

                        // Determine UserId based on Role
                        String role = envelope.getFrom().getRole();
                        String userId;

                        if ("HOST".equalsIgnoreCase(role)) {
                                // Host connects as the session owner
                                userId = String.valueOf(session.getHostUserId());
                        } else {
                                // Guest connects with unique clientId
                                userId = clientId;
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
                                                        "sdp", sdpAnswer))
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
         * TODO: Media Server gRPC 호출
         *
         * @param envelope ICE Candidate 메시지
         */
        @SuppressWarnings("unchecked")
        public void handleIce(Envelope envelope) {
                String sessionId = envelope.getSessionId();
                String clientId = envelope.getFrom().getClientId();
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

                        // CRITICAL: 역할에 따라 userId 결정
                        String role = envelope.getFrom().getRole();
                        String userId;
                        if ("HOST".equalsIgnoreCase(role)) {
                                userId = String.valueOf(session.getHostUserId());
                        } else {
                                userId = clientId;
                        }

                        if (candidate != null && sdpMLineIndex != null) {
                                mediaServerClient.submitIceCandidate(
                                                sessionId,
                                                userId,
                                                candidate,
                                                sdpMid,
                                                sdpMLineIndex);
                        } else {
                                log.warn("Invalid ICE Candidate payload: {}", payload);
                        }
                } catch (Exception e) {
                        log.error("Failed to submit ICE Candidate: {}", e.getMessage());
                }
        }

        /**
         * SYS_ERROR 응답 전송
         *
         * 모든 에러는 SYS_ERROR Envelope로 응답
         *
         * @param originalEnvelope 원본 메시지
         * @param errorCode        에러 코드 (INVALID_STATE, UNKNOWN_TYPE 등)
         * @param errorMessage     에러 메시지
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
                                                "message", errorMessage))
                                .build();

                String destination = "/topic/channel/" + originalEnvelope.getChannelId();
                messagingTemplate.convertAndSend(destination, errorResponse);

                log.warn("Sent error: sessionId={}, code={}, message={}",
                                originalEnvelope.getSessionId(), errorCode, errorMessage);
        }
}
