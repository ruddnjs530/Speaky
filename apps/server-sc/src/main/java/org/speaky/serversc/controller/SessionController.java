package org.speaky.serversc.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.domain.SessionEntity;
import org.speaky.serversc.domain.SessionStatus;
import org.speaky.serversc.domain.User;
import org.speaky.serversc.dto.*;
import org.speaky.serversc.exception.SessionNotFoundException;
import org.speaky.serversc.repository.UserRepository;
import org.speaky.serversc.security.JwtTokenProvider;
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
@RequestMapping("/api/v1/sessions")
@RequiredArgsConstructor
public class SessionController {

        private final SessionService sessionService;
        private final JwtTokenProvider jwtTokenProvider;
        private final UserRepository userRepository;

        /**
         * 세션 생성
         * 
         * POST /api/sessions
         */
        @PostMapping
        public ResponseEntity<SessionResponse> createSession(
                        @Valid @RequestBody CreateSessionRequest request) {

                // channelId 자동 생성 (없으면)
                String channelId = request.getChannelId();
                if (channelId == null || channelId.isBlank()) {
                        channelId = "ch_user_" + request.getHostUserId();
                }

                log.info("Creating session: hostUserId={}, channelId={}, title={}",
                                request.getHostUserId(), channelId, request.getTitle());

                var session = sessionService.createSession(
                                request.getHostUserId(),
                                channelId,
                                request.getVoiceModelID(), // 새 필드명 사용
                                request.getTitle());

                // 사용자 정보 조회하여 JWT 토큰 생성
                User user = userRepository.findById(request.getHostUserId())
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "User not found: " + request.getHostUserId()));
                
                String jwtToken = jwtTokenProvider.generateAccessToken(user);

                // Response 생성 및 WebSocket 정보 추가
                SessionResponse response = SessionResponse.from(session);
                // 환경 변수 VITE_WS_URL (또는 WS_URL) 읽기, 없으면 localhost 기본값
                String wsUrl = System.getenv("VITE_WS_URL");
                if (wsUrl == null || wsUrl.isBlank()) {
                    wsUrl = System.getenv("WS_URL");
                }
                if (wsUrl == null || wsUrl.isBlank()) {
                    wsUrl = "ws://localhost:8080/ws/signaling";
                }
                response.setWsUrl(wsUrl);
                response.setSignalingToken(jwtToken); // 실제 JWT 토큰 사용

                return ResponseEntity.status(HttpStatus.CREATED)
                                .body(response);
        }

        /**
         * 세션 ID로 조회
         * 
         * GET /api/sessions/{sessionId}
         */
        @GetMapping("/{sessionId}")
        public ResponseEntity<SessionResponse> getSession(
                        @PathVariable String sessionId) {

                SessionEntity session = sessionService.getSession(sessionId);

                return ResponseEntity.ok(SessionResponse.from(session));
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

                SessionEntity session = sessionService.startBroadcast(
                                sessionId,
                                request.getMediaServerId(),
                                request.getPipelineId());

                return ResponseEntity.ok(SessionResponse.from(session));
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

                SessionEntity session = sessionService.endBroadcast(sessionId, request.getReason());
                return ResponseEntity.ok(SessionResponse.from(session));
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

                SessionEntity session = sessionService.failBroadcast(sessionId, request.getReason());
                return ResponseEntity.ok(SessionResponse.from(session));
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
