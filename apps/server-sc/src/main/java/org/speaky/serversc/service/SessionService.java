package org.speaky.serversc.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.domain.SessionEntity;
import org.speaky.serversc.domain.SessionStatus;
import org.speaky.serversc.repository.SessionRepository;
import org.springframework.stereotype.Service;

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
    
    /**
     * 새 방송 세션 생성
     * 
     * @param hostUserId 호스트(방송자) 사용자 ID
     * @param voiceModelId 음성 모델 ID
     * @param title 방송 제목
     * @return 생성된 세션 엔티티
     */
    public SessionEntity createSession(Long hostUserId, Long voiceModelId, String title) {
        String sessionId = generateSessionId();
        LocalDateTime now = LocalDateTime.now();
        
        SessionEntity session = SessionEntity.builder()
                .sessionId(sessionId)
                .hostUserId(hostUserId)
                .voiceModelId(voiceModelId)
                .title(title)
                .status(SessionStatus.STARTING) // 초기 상태는 STARTING
                .createdAt(now)
                .build();
        
        sessionRepository.save(session);
        
        log.info("Created new session: sessionId={}, hostUserId={}, title={}", 
                sessionId, hostUserId, title);
        
        return session;
    }
    
    /**
     * 세션 ID로 조회
     * 
     * @param sessionId 세션 ID
     * @return Optional로 래핑된 세션
     */
    public Optional<SessionEntity> getSession(String sessionId) {
        return sessionRepository.findById(sessionId);
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
     * @return 업데이트된 세션 (없으면 Optional.empty())
     */
    public Optional<SessionEntity> startBroadcast(String sessionId, String mediaServerId, String pipelineId) {
        Optional<SessionEntity> sessionOpt = sessionRepository.findById(sessionId);
        
        if (sessionOpt.isEmpty()) {
            log.warn("Session not found for broadcast start: sessionId={}", sessionId);
            return Optional.empty();
        }
        
        SessionEntity session = sessionOpt.get();
        
        if (session.getStatus() != SessionStatus.STARTING) {
            log.warn("Cannot start broadcast: session is not in STARTING state. sessionId={}, currentStatus={}", 
                    sessionId, session.getStatus());
            return Optional.empty();
        }
        
        session.setStatus(SessionStatus.LIVE);
        session.setStartedAt(LocalDateTime.now());
        session.setMediaServerId(mediaServerId);
        session.setPipelineId(pipelineId);
        
        sessionRepository.save(session);
        
        log.info("Broadcast started: sessionId={}, mediaServerId={}, pipelineId={}", 
                sessionId, mediaServerId, pipelineId);
        
        return Optional.of(session);
    }
    
    /**
     * 방송 종료 (LIVE -> ENDED)
     * 
     * @param sessionId 세션 ID
     * @param endedReason 종료 사유
     * @return 업데이트된 세션 (없으면 Optional.empty())
     */
    public Optional<SessionEntity> endBroadcast(String sessionId, String endedReason) {
        Optional<SessionEntity> sessionOpt = sessionRepository.findById(sessionId);
        
        if (sessionOpt.isEmpty()) {
            log.warn("Session not found for broadcast end: sessionId={}", sessionId);
            return Optional.empty();
        }
        
        SessionEntity session = sessionOpt.get();
        session.setStatus(SessionStatus.ENDED);
        session.setEndedAt(LocalDateTime.now());
        session.setEndedReason(endedReason);
        
        sessionRepository.save(session);
        
        log.info("Broadcast ended: sessionId={}, reason={}", sessionId, endedReason);
        
        return Optional.of(session);
    }
    
    /**
     * 방송 실패 처리 (ANY -> FAILED)
     * 
     * @param sessionId 세션 ID
     * @param failureReason 실패 사유
     * @return 업데이트된 세션 (없으면 Optional.empty())
     */
    public Optional<SessionEntity> failBroadcast(String sessionId, String failureReason) {
        Optional<SessionEntity> sessionOpt = sessionRepository.findById(sessionId);
        
        if (sessionOpt.isEmpty()) {
            log.warn("Session not found for broadcast failure: sessionId={}", sessionId);
            return Optional.empty();
        }
        
        SessionEntity session = sessionOpt.get();
        session.setStatus(SessionStatus.FAILED);
        session.setEndedAt(LocalDateTime.now());
        session.setEndedReason(failureReason);
        
        sessionRepository.save(session);
        
        log.error("Broadcast failed: sessionId={}, reason={}", sessionId, failureReason);
        
        return Optional.of(session);
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
