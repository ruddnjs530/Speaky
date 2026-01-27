package org.speaky.serversc.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.speaky.serversc.domain.SessionEntity;
import org.speaky.serversc.domain.SessionStatus;
import org.speaky.serversc.repository.SessionRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * SessionService 단위 테스트
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SessionService Tests")
class SessionServiceTest {
    
    @Mock
    private SessionRepository sessionRepository;
    
    @Mock
    private SessionEventPublisher eventPublisher;
    
    @InjectMocks
    private SessionService sessionService;
    
    @Test
    @DisplayName("새 방송 세션 생성")
    void testCreateSession() {
        // Given
        Long hostUserId = 1L;
        Long voiceModelId = 100L;
        String title = "Test Broadcast";
        
        // When
        SessionEntity created = sessionService.createSession(hostUserId, voiceModelId, title);
        
        // Then
        assertThat(created).isNotNull();
        assertThat(created.getHostUserId()).isEqualTo(hostUserId);
        assertThat(created.getVoiceModelId()).isEqualTo(voiceModelId);
        assertThat(created.getTitle()).isEqualTo(title);
        assertThat(created.getStatus()).isEqualTo(SessionStatus.STARTING);
        assertThat(created.getCreatedAt()).isNotNull();
        
        verify(sessionRepository, times(1)).save(any(SessionEntity.class));
    }
    
    @Test
    @DisplayName("방송 시작 성공")
    void testStartBroadcast() {
        // Given
        String sessionId = "test-session";
        String mediaServerId = "media-1";
        String pipelineId = "pipeline-1";
        
        SessionEntity session = SessionEntity.builder()
                .sessionId(sessionId)
                .hostUserId(1L)
                .voiceModelId(100L)
                .title("Test")
                .status(SessionStatus.STARTING)
                .createdAt(LocalDateTime.now())
                .build();
        
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        
        // When
        Optional<SessionEntity> result = sessionService.startBroadcast(sessionId, mediaServerId, pipelineId);
        
        // Then
        assertThat(result).isPresent();
        assertThat(result.get().getStatus()).isEqualTo(SessionStatus.LIVE);
        assertThat(result.get().getStartedAt()).isNotNull();
        assertThat(result.get().getMediaServerId()).isEqualTo(mediaServerId);
        assertThat(result.get().getPipelineId()).isEqualTo(pipelineId);
        
        verify(sessionRepository, times(1)).save(session);
    }
    
    @Test
    @DisplayName("방송 시작 실패 - STARTING 상태가 아님")
    void testStartBroadcastFailWrongStatus() {
        // Given
        String sessionId = "test-session";
        SessionEntity session = SessionEntity.builder()
                .sessionId(sessionId)
                .status(SessionStatus.LIVE) // 이미 LIVE 상태
                .build();
        
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        
        // When
        Optional<SessionEntity> result = sessionService.startBroadcast(sessionId, "media-1", "pipeline-1");
        
        // Then
        assertThat(result).isEmpty();
        verify(sessionRepository, never()).save(any());
    }
    
    @Test
    @DisplayName("방송 종료")
    void testEndBroadcast() {
        // Given
        String sessionId = "test-session";
        String endedReason = "User requested";
        
        SessionEntity session = SessionEntity.builder()
                .sessionId(sessionId)
                .status(SessionStatus.LIVE)
                .build();
        
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        
        // When
        Optional<SessionEntity> result = sessionService.endBroadcast(sessionId, endedReason);
        
        // Then
        assertThat(result).isPresent();
        assertThat(result.get().getStatus()).isEqualTo(SessionStatus.ENDED);
        assertThat(result.get().getEndedAt()).isNotNull();
        assertThat(result.get().getEndedReason()).isEqualTo(endedReason);
        
        verify(sessionRepository, times(1)).save(session);
    }
    
    @Test
    @DisplayName("방송 실패 처리")
    void testFailBroadcast() {
        // Given
        String sessionId = "test-session";
        String failureReason = "Technical error";
        
        SessionEntity session = SessionEntity.builder()
                .sessionId(sessionId)
                .status(SessionStatus.STARTING)
                .build();
        
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        
        // When
        Optional<SessionEntity> result = sessionService.failBroadcast(sessionId, failureReason);
        
        // Then
        assertThat(result).isPresent();
        assertThat(result.get().getStatus()).isEqualTo(SessionStatus.FAILED);
        assertThat(result.get().getEndedAt()).isNotNull();
        assertThat(result.get().getEndedReason()).isEqualTo(failureReason);
        
        verify(sessionRepository, times(1)).save(session);
    }
    
    @Test
    @DisplayName("종료된 세션 정리")
    void testCleanupCompletedSessions() {
        // Given
        SessionEntity endedSession = SessionEntity.builder()
                .sessionId("session-1")
                .status(SessionStatus.ENDED)
                .build();
        
        SessionEntity failedSession = SessionEntity.builder()
                .sessionId("session-2")
                .status(SessionStatus.FAILED)
                .build();
        
        SessionEntity liveSession = SessionEntity.builder()
                .sessionId("session-3")
                .status(SessionStatus.LIVE)
                .build();
        
        when(sessionRepository.findAll()).thenReturn(List.of(endedSession, failedSession, liveSession));
        
        // When
        int deletedCount = sessionService.cleanupCompletedSessions();
        
        // Then
        assertThat(deletedCount).isEqualTo(2);
        verify(sessionRepository, times(1)).deleteById("session-1");
        verify(sessionRepository, times(1)).deleteById("session-2");
        verify(sessionRepository, never()).deleteById("session-3");
    }
}
