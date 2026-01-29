package org.speaky.serversc.repository;

import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.domain.SessionEntity;
import org.speaky.serversc.domain.SessionStatus;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * In-Memory 세션 저장소 구현체 (MVP 기본 구현)
 * 
 * - ConcurrentHashMap 기반 thread-safe 구현
 * - @Primary로 기본 구현체 지정
 * - 서버 재시작 시 데이터 손실 (향후 Redis/DB로 전환 가능)
 */
@Slf4j
@Primary
@Repository
public class InMemorySessionRepository implements SessionRepository {
    
    /**
     * 세션 저장소: sessionId -> SessionEntity
     */
    private final ConcurrentHashMap<String, SessionEntity> sessionStore = new ConcurrentHashMap<>();
    
    @Override
    public void save(SessionEntity session) {
        if (session == null || session.getSessionId() == null) {
            log.warn("Attempted to save null session or session with null ID");
            return;
        }
        
        sessionStore.put(session.getSessionId(), session);
        log.debug("Saved session: sessionId={}, hostUserId={}, title={}, status={}", 
                session.getSessionId(), session.getHostUserId(), session.getTitle(), session.getStatus());
    }
    
    @Override
    public Optional<SessionEntity> findById(String sessionId) {
        if (sessionId == null) {
            return Optional.empty();
        }
        
        return Optional.ofNullable(sessionStore.get(sessionId));
    }
    
    @Override
    public List<SessionEntity> findByHostUserId(Long hostUserId) {
        if (hostUserId == null) {
            return List.of();
        }
        
        return sessionStore.values().stream()
                .filter(session -> hostUserId.equals(session.getHostUserId()))
                .collect(Collectors.toList());
    }
    
    @Override
    public List<SessionEntity> findByStatus(SessionStatus status) {
        if (status == null) {
            return List.of();
        }
        
        return sessionStore.values().stream()
                .filter(session -> status.equals(session.getStatus()))
                .collect(Collectors.toList());
    }
    
    @Override
    public Optional<SessionEntity> findByChannelIdAndStatus(String channelId, SessionStatus status) {
        if (channelId == null || status == null) {
            return Optional.empty();
        }
        
        return sessionStore.values().stream()
                .filter(session -> channelId.equals(session.getChannelId()))
                .filter(session -> status.equals(session.getStatus()))
                .findFirst();
    }
    
    @Override
    public List<SessionEntity> findByChannelId(String channelId) {
        if (channelId == null) {
            return List.of();
        }
        
        return sessionStore.values().stream()
                .filter(session -> channelId.equals(session.getChannelId()))
                .collect(Collectors.toList());
    }
    
    @Override
    public void deleteById(String sessionId) {
        if (sessionId == null) {
            log.warn("Attempted to delete session with null ID");
            return;
        }
        
        SessionEntity removed = sessionStore.remove(sessionId);
        if (removed != null) {
            log.debug("Deleted session: sessionId={}", sessionId);
        } else {
            log.debug("Session not found for deletion: sessionId={}", sessionId);
        }
    }
    
    @Override
    public List<SessionEntity> findAll() {
        return List.copyOf(sessionStore.values());
    }
    
    /**
     * 저장소의 현재 세션 개수 반환 (모니터링/테스트용)
     */
    public int size() {
        return sessionStore.size();
    }
    
    /**
     * 저장소 전체 초기화 (테스트용)
     */
    public void clear() {
        sessionStore.clear();
        log.debug("Cleared all sessions from in-memory store");
    }
}
