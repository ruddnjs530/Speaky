package org.speaky.serversc.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.domain.SessionEntity;
import org.speaky.serversc.domain.SessionEventType;
import org.speaky.serversc.domain.SessionStatus;
import org.speaky.serversc.dto.SessionEventPayload;
import org.speaky.serversc.exception.InvalidSessionStateException;
import org.speaky.serversc.exception.SessionNotFoundException;
import org.speaky.serversc.exception.MediaServerException;
import org.speaky.serversc.repository.SessionRepository;
import org.springframework.stereotype.Service;

import org.speaky.serversc.client.MediaServerClient;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * 세션 관리 비즈니스 로직
 * 
 * WebSocket 방송 세션 생성, 조회, 상태 변경, 삭제 등의 핵심 기능 제공
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SessionService {
    
    private final SessionRepository sessionRepository;
    private final SessionEventPublisher eventPublisher;
    private final MediaServerClient mediaServerClient;
    
    /**
     * 새 방송 세션 생성
     * 
     * @param host UserId 호스트(방송자) 사용자 ID
     * @param channelId 채널 ID (예: "ch_user_faker")
     * @param voiceModelId 음성 모델 ID
     * @param title 방송 제목
     * @return 생성된 세션 엔티티
     */
    public SessionEntity createSession(Long hostUserId, String channelId, Long voiceModelId, String title) {
        String sessionId = generateSessionId();
        LocalDateTime now = LocalDateTime.now();
        
        SessionEntity session = SessionEntity.builder()
                .sessionId(sessionId)
                .channelId(channelId)
                .hostUserId(hostUserId)
                .voiceModelId(voiceModelId)
                .title(title)
                .status(SessionStatus.STARTING) // 초기 상태는 STARTING
                .createdAt(now)
                .build();
        
        sessionRepository.save(session);
        
        // WebSocket 이벤트 발행
        eventPublisher.publishSessionEvent(
            SessionEventPayload.builder()
                .eventType(SessionEventType.SYS_SESSION_CREATED)
                .sessionId(session.getSessionId())
                .timestamp(now)
                .sessionData(session)
                .build()
        );
        
        log.info("Created new session: sessionId={}, channelId={}, hostUserId={}, title={}", 
                sessionId, channelId, hostUserId, title);
        
        return session;
    }
    
    /**
     * 세션 ID로 조회
     * 
     * @param sessionId 세션 ID
     * @return Optional로 래핑된 세션
     */
    public SessionEntity getSession(String sessionId) {
        SessionEntity session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
        return session;
    }
    
    /**
     * 호스트 사용자 ID로 세션 목록 조회
     * 
     * @param hostUserId 호스트 사용자 ID
     * @return 해당 호스트의 세션 목록
     */
    public List<SessionEntity> getSessionsByHostUserId(Long hostUserId) {
        return sessionRepository.findByHostUserId(hostUserId);
    }
    
    /**
     * 상태별 세션 목록 조회
     * 
     * @param status 세션 상태
     * @return 해당 상태의 세션 목록
     */
    public List<SessionEntity> getSessionsByStatus(SessionStatus status) {
        return sessionRepository.findByStatus(status);
    }
    
    /**
     * 방송 시작 (STARTING -> LIVE)
     * 
     * @param sessionId 세션 ID
     * @param mediaServerId 미디어 서버 ID
     * @param pipelineId 파이프라인 ID
     * @return 업데이트된 세션
     * @throws SessionNotFoundException 세션을 찾을 수 없는 경우
     */
    public SessionEntity startBroadcast(String sessionId, String mediaServerId, String pipelineId) {
        SessionEntity session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
        
        if (session.getStatus() != SessionStatus.STARTING) {
            throw new InvalidSessionStateException(
                sessionId,
                session.getStatus().toString(),
                SessionStatus.STARTING.toString()
            );
        }
        
        // Media Server에 Room 생성 요청
        try {
            mediaServerClient.createRoom(sessionId, String.valueOf(session.getHostUserId()));
        } catch (Exception e) {
            log.error("Failed to create room in Media Server: {}", e.getMessage());
            // 필요한 경우 여기서 예외를 던져서 방송 시작을 막을 수 있음
            throw new RuntimeException("Failed to start broadcast: Media Server error", e);
        }

        session.setStatus(SessionStatus.LIVE);
        session.setStartedAt(LocalDateTime.now());
        session.setMediaServerId(mediaServerId);
        session.setPipelineId(pipelineId);
        
        sessionRepository.save(session);
        
        // WebSocket 이벤트 발행
        eventPublisher.publishSessionEvent(
            SessionEventPayload.builder()
                .eventType(SessionEventType.SYS_SESSION_STARTED)
                .sessionId(sessionId)
                .timestamp(session.getStartedAt())
                .sessionData(session)
                .build()
        );
        
        log.info("Broadcast started: sessionId={}, mediaServerId={}, pipelineId={}", 
                sessionId, mediaServerId, pipelineId);
        
        return session;
    }
    
    /**
     * 방송 종료 (LIVE -> ENDED)
     * 
     * @param sessionId 세션 ID
     * @param endedReason 종료 사유
     * @return 업데이트된 세션
     * @throws SessionNotFoundException 세션을 찾을 수 없는 경우
     */
    public SessionEntity endBroadcast(String sessionId, String endedReason) {
        SessionEntity session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
        
        session.setStatus(SessionStatus.ENDED);
        session.setEndedAt(LocalDateTime.now());
        session.setEndedReason(endedReason);
        
        sessionRepository.save(session);
        
        // Media Server Room 정리
        try {
            mediaServerClient.deleteRoom(sessionId);
            log.info("Media server room deleted: sessionId={}", sessionId);
        } catch (MediaServerException e) {
            // deleteRoom 실패는 비치명적 - 로깅하고 계속 진행
            // 미디어 서버 장애나 일시적 통신 문제로 실패할 수 있음
            log.warn("Failed to delete media server room: sessionId={}, errorCode={}", 
                    sessionId, e.getErrorCode(), e);
            
            // TODO: 주기적인 cleanup 배치 작업 고려
            // - 미디어 서버의 고아 Room 목록 조회 및 정리
            // - 실패한 deleteRoom 재시도 큐 구현
        }
        
        // WebSocket 이벤트 발행
        eventPublisher.publishSessionEvent(
            SessionEventPayload.builder()
                .eventType(SessionEventType.SYS_SESSION_ENDED)
                .sessionId(sessionId)
                .timestamp(session.getEndedAt())
                .sessionData(session)
                .build()
        );
        
        log.info("Broadcast ended: sessionId={}, reason={}", sessionId, endedReason);
        
        return session;
    }
    
    /**
     * 방송 실패 처리 (ANY -> FAILED)
     * 
     * @param sessionId 세션 ID
     * @param failureReason 실패 사유
     * @return 업데이트된 세션
     * @throws SessionNotFoundException 세션을 찾을 수 없는 경우
     */
    public SessionEntity failBroadcast(String sessionId, String failureReason) {
        SessionEntity session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new SessionNotFoundException(sessionId));
        
        session.setStatus(SessionStatus.FAILED);
        session.setEndedAt(LocalDateTime.now());
        session.setEndedReason(failureReason);
        
        sessionRepository.save(session);
        
        // WebSocket 이벤트 발행
        eventPublisher.publishSessionEvent(
            SessionEventPayload.builder()
                .eventType(SessionEventType.SYS_SESSION_FAILED)
                .sessionId(sessionId)
                .timestamp(session.getEndedAt())
                .sessionData(session)
                .build()
        );
        
        log.error("Broadcast failed: sessionId={}, reason={}", sessionId, failureReason);
        
        return session;
    }
    
    /**
     * 세션 상태 직접 변경 (일반적으로는 위의 메서드 사용 권장)
     * 
     * @param sessionId 세션 ID
     * @param newStatus 새 상태
     * @return 업데이트된 세션 (없으면 Optional.empty())
     */
    public Optional<SessionEntity> updateSessionStatus(String sessionId, SessionStatus newStatus) {
        Optional<SessionEntity> sessionOpt = sessionRepository.findById(sessionId);
        
        if (sessionOpt.isEmpty()) {
            log.warn("Session not found for status update: sessionId={}", sessionId);
            return Optional.empty();
        }
        
        SessionEntity session = sessionOpt.get();
        SessionStatus oldStatus = session.getStatus();
        session.setStatus(newStatus);
        
        sessionRepository.save(session);
        
        log.info("Updated session status: sessionId={}, {} -> {}", 
                sessionId, oldStatus, newStatus);
        
        return Optional.of(session);
    }
    
    /**
     * 세션 삭제
     * 
     * @param sessionId 세션 ID
     */
    public void deleteSession(String sessionId) {
        sessionRepository.deleteById(sessionId);
        log.info("Deleted session: sessionId={}", sessionId);
    }
    
    /**
     * 모든 세션 조회
     * 
     * @return 전체 세션 목록
     */
    public List<SessionEntity> getAllSessions() {
        return sessionRepository.findAll();
    }
    
    /**
     * 세션 ID 생성 (UUID 기반)
     * 
     * @return 고유한 세션 ID
     */
    private String generateSessionId() {
        return UUID.randomUUID().toString();
    }
    
    /**
     * 종료된 세션 정리 (ENDED, FAILED 상태 세션 삭제)
     * 
     * @return 삭제된 세션 개수
     */
    public int cleanupCompletedSessions() {
        List<SessionEntity> allSessions = sessionRepository.findAll();
        
        int deletedCount = 0;
        for (SessionEntity session : allSessions) {
            if (session.getStatus() == SessionStatus.ENDED || 
                session.getStatus() == SessionStatus.FAILED) {
                sessionRepository.deleteById(session.getSessionId());
                deletedCount++;
            }
        }
        
        if (deletedCount > 0) {
            log.info("Cleaned up {} completed sessions", deletedCount);
        }
        
        return deletedCount;
    }
}
