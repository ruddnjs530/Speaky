package org.speaky.serversc.repository;

import org.speaky.serversc.domain.SessionEntity;
import org.speaky.serversc.domain.SessionStatus;

import java.util.List;
import java.util.Optional;

/**
 * 세션 저장소 추상화 인터페이스
 * 
 * 전략 패턴을 사용하여 구현체(InMemory/Redis/DB)를 교체 가능하게 설계
 * Optional을 사용하여 null-safe API 제공 (NPE 방지)
 */
public interface SessionRepository {
    
    /**
     * 세션 저장 또는 업데이트
     * 
     * @param session 저장할 세션 엔티티
     */
    void save(SessionEntity session);
    
    /**
     * 세션 ID로 조회
     * 
     * @param sessionId 세션 ID
     * @return Optional로 래핑된 세션 (없으면 Optional.empty())
     */
    Optional<SessionEntity> findById(String sessionId);
    
    /**
     * 호스트 사용자 ID로 세션 목록 조회
     * 
     * @param hostUserId 호스트 사용자 ID
     * @return 해당 호스트의 세션 목록
     */
    List<SessionEntity> findByHostUserId(Long hostUserId);
    
    /**
     * 상태별 세션 목록 조회
     * 
     * @param status 세션 상태
     * @return 해당 상태의 세션 목록
     */
    List<SessionEntity> findByStatus(SessionStatus status);
    
    /**
     * 세션 ID로 삭제
     * 
     * @param sessionId 삭제할 세션 ID
     */
    void deleteById(String sessionId);
    
    /**
     * 모든 세션 조회
     * 
     * @return 전체 세션 목록
     */
    List<SessionEntity> findAll();
}
