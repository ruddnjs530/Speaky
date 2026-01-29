package org.speaky.serversc.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.speaky.serversc.domain.SessionEntity;
import org.speaky.serversc.domain.SessionStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * InMemorySessionRepository 단위 테스트
 */
@DisplayName("InMemorySessionRepository Tests")
class InMemorySessionRepositoryTest {
    
    private InMemorySessionRepository repository;
    
    @BeforeEach
    void setUp() {
        repository = new InMemorySessionRepository();
    }
    
    @Test
    @DisplayName("세션 저장 및 조회")
    void testSaveAndFindById() {
        // Given
        SessionEntity session = createTestSession("session-1", 1L, "ch_test", 100L, "Test Broadcast");
        
        // When
        repository.save(session);
        Optional<SessionEntity> found = repository.findById("session-1");
        
        // Then
        assertThat(found).isPresent();
        assertThat(found.get().getSessionId()).isEqualTo("session-1");
        assertThat(found.get().getTitle()).isEqualTo("Test Broadcast");
    }
    
    @Test
    @DisplayName("존재하지 않는 세션 조회 시 Optional.empty() 반환")
    void testFindByIdNotFound() {
        // When
        Optional<SessionEntity> found = repository.findById("non-existent");
        
        // Then
        assertThat(found).isEmpty();
    }
    
    @Test
    @DisplayName("호스트 사용자 ID로 세션 목록 조회")
    void testFindByHostUserId() {
        // Given
        SessionEntity session1 = createTestSession("session-1", 1L, "ch_test", 100L, "Broadcast 1");
        SessionEntity session2 = createTestSession("session-2", 1L, "ch_test", 101L, "Broadcast 2");
        SessionEntity session3 = createTestSession("session-3", 2L, "ch_test", 102L, "Broadcast 3");
        
        repository.save(session1);
        repository.save(session2);
        repository.save(session3);
        
        // When
        List<SessionEntity> sessions = repository.findByHostUserId(1L);
        
        // Then
        assertThat(sessions).hasSize(2);
        assertThat(sessions).extracting(SessionEntity::getSessionId)
                .containsExactlyInAnyOrder("session-1", "session-2");
    }
    
    @Test
    @DisplayName("상태별 세션 목록 조회")
    void testFindByStatus() {
        // Given
        SessionEntity session1 = createTestSession("session-1", 1L, "ch_test", 100L, "Broadcast 1");
        session1.setStatus(SessionStatus.LIVE);
        
        SessionEntity session2 = createTestSession("session-2", 2L, "ch_test", 101L, "Broadcast 2");
        session2.setStatus(SessionStatus.LIVE);
        
        SessionEntity session3 = createTestSession("session-3", 3L, "ch_test", 102L, "Broadcast 3");
        session3.setStatus(SessionStatus.ENDED);
        
        repository.save(session1);
        repository.save(session2);
        repository.save(session3);
        
        // When
        List<SessionEntity> liveSessions = repository.findByStatus(SessionStatus.LIVE);
        List<SessionEntity> endedSessions = repository.findByStatus(SessionStatus.ENDED);
        
        // Then
        assertThat(liveSessions).hasSize(2);
        assertThat(endedSessions).hasSize(1);
    }
    
    @Test
    @DisplayName("세션 삭제")
    void testDeleteById() {
        // Given
        SessionEntity session = createTestSession("session-1", 1L, "ch_test", 100L, "Test Broadcast");
        repository.save(session);
        
        // When
        repository.deleteById("session-1");
        Optional<SessionEntity> found = repository.findById("session-1");
        
        // Then
        assertThat(found).isEmpty();
    }
    
    @Test
    @DisplayName("전체 세션 조회")
    void testFindAll() {
        // Given
        repository.save(createTestSession("session-1", 1L, "ch_test", 100L, "Broadcast 1"));
        repository.save(createTestSession("session-2", 2L, "ch_test", 101L, "Broadcast 2"));
        repository.save(createTestSession("session-3", 3L, "ch_test", 102L, "Broadcast 3"));
        
        // When
        List<SessionEntity> allSessions = repository.findAll();
        
        // Then
        assertThat(allSessions).hasSize(3);
    }
    
    @Test
    @DisplayName("저장소 크기 확인")
    void testSize() {
        // Given
        repository.save(createTestSession("session-1", 1L, "ch_test", 100L, "Broadcast 1"));
        repository.save(createTestSession("session-2", 2L, "ch_test", 101L, "Broadcast 2"));
        
        // When & Then
        assertThat(repository.size()).isEqualTo(2);
    }
    
    @Test
    @DisplayName("저장소 초기화")
    void testClear() {
        // Given
        repository.save(createTestSession("session-1", 1L, "ch_test", 100L, "Broadcast 1"));
        repository.save(createTestSession("session-2", 2L, "ch_test", 101L, "Broadcast 2"));
        
        // When
        repository.clear();
        
        // Then
        assertThat(repository.size()).isZero();
        assertThat(repository.findAll()).isEmpty();
    }
    
    
    private SessionEntity createTestSession(String sessionId, Long hostUserId, String channelId, Long voiceModelId, String title) {
        return SessionEntity.builder()
                .sessionId(sessionId)
                .channelId(channelId)
                .hostUserId(hostUserId)
                .voiceModelId(voiceModelId)
                .title(title)
                .status(SessionStatus.STARTING)
                .createdAt(LocalDateTime.now())
                .build();
    }
}
