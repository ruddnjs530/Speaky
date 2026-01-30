package org.speaky.serversc.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.speaky.serversc.domain.SessionEntity;
import org.speaky.serversc.domain.SessionStatus;
import org.speaky.serversc.dto.*;
import org.speaky.serversc.exception.SessionNotFoundException;
import org.speaky.serversc.service.SessionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * SessionController 단위 테스트
 * 
 * Mockito를 사용하여 Service Layer를 Mocking하고 Controller 로직만 검증
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SessionController Unit Tests")
class SessionControllerTest {
    
    @Mock
    private SessionService sessionService;
    
    @InjectMocks
    private SessionController sessionController;
    
    @Test
    @DisplayName("세션 생성 성공")
    void createSession_Success() {
        // Given
        CreateSessionRequest request = new CreateSessionRequest();
        request.setHostUserId(1L);
        request.setChannelId("ch_test");
        request.setVoiceModelID(100L);
        request.setTitle("Test Session");
        
        SessionEntity session = createTestSession("session-1", 1L, "ch_test", 100L, "Test Session");
        when(sessionService.createSession(1L, "ch_test", 100L, "Test Session")).thenReturn(session);
        
        // When
        ResponseEntity<SessionResponse> response = sessionController.createSession(request);
        
        // Then
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getSessionId()).isEqualTo("session-1");
        assertThat(response.getBody().getTitle()).isEqualTo("Test Session");
        
        verify(sessionService).createSession(1L, "ch_test", 100L, "Test Session");
    }
    
    @Test
    @DisplayName("세션 ID로 조회 성공")
    void getSession_Success() {
        // Given
        SessionEntity session = createTestSession("session-1", 1L, "ch_test", 100L, "Test Session");
        when(sessionService.getSession("session-1")).thenReturn(session);
        
        // When
        ResponseEntity<SessionResponse> response = sessionController.getSession("session-1");
        
        // Then
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getSessionId()).isEqualTo("session-1");
        
        verify(sessionService).getSession("session-1");
    }
    
    @Test
    @DisplayName("세션 조회 실패 - 존재하지 않음")
    void getSession_NotFound() {
        // Given
        when(sessionService.getSession("any")).thenThrow(new SessionNotFoundException("any"));
        
        // When & Then
        assertThatThrownBy(() -> sessionController.getSession("any"))
                .isInstanceOf(SessionNotFoundException.class)
                .hasMessageContaining("Session not found: any");
    }
    
    @Test
    @DisplayName("호스트 사용자 ID로 세션 목록 조회")
    void getSessionsByHost_Success() {
        // Given
        SessionEntity session = createTestSession("session-1", 1L, "ch_test", 100L, "Test Session");
        when(sessionService.getSessionsByHostUserId(1L)).thenReturn(List.of(session));
        
        // When
        ResponseEntity<List<SessionResponse>> response = sessionController.getSessionsByHost(1L);
        
        // Then
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(1);
        assertThat(response.getBody().get(0).getSessionId()).isEqualTo("session-1");
    }
    
    @Test
    @DisplayName("상태별 세션 목록 조회")
    void getSessionsByStatus_Success() {
        // Given
        SessionEntity session = createTestSession("session-1", 1L, "ch_test", 100L, "Test Session");
        session.setStatus(SessionStatus.LIVE);
        when(sessionService.getSessionsByStatus(SessionStatus.LIVE)).thenReturn(List.of(session));
        
        // When
        ResponseEntity<List<SessionResponse>> response = sessionController.getSessionsByStatus(SessionStatus.LIVE);
        
        // Then
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(1);
        assertThat(response.getBody().get(0).getStatus()).isEqualTo(SessionStatus.LIVE);
    }
    
    @Test
    @DisplayName("방송 시작 성공")
    void startBroadcast_Success() {
        // Given
        StartBroadcastRequest request = new StartBroadcastRequest();
        request.setMediaServerId("server-1");
        request.setPipelineId("pipe-1");
        
        SessionEntity session = createTestSession("session-1", 1L, "ch_test", 100L, "Test");
        session.setStatus(SessionStatus.LIVE);
        
        when(sessionService.startBroadcast("session-1", "server-1", "pipe-1")).thenReturn(session);
        
        // When
        ResponseEntity<SessionResponse> response = sessionController.startBroadcast("session-1", request);
        
        // Then
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getStatus()).isEqualTo(SessionStatus.LIVE);
    }
    
    @Test
    @DisplayName("방송 종료 성공")
    void endBroadcast_Success() {
        // Given
        EndBroadcastRequest request = new EndBroadcastRequest();
        request.setReason("End reason");
        
        SessionEntity session = createTestSession("session-1", 1L, "ch_test", 100L, "Test");
        session.setStatus(SessionStatus.ENDED);
        
        when(sessionService.endBroadcast("session-1", "End reason")).thenReturn(session);
        
        // When
        ResponseEntity<SessionResponse> response = sessionController.endBroadcast("session-1", request);
        
        // Then
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getStatus()).isEqualTo(SessionStatus.ENDED);
    }
    
    @Test
    @DisplayName("세션 삭제 성공")
    void deleteSession_Success() {
        // When
        ResponseEntity<Void> response = sessionController.deleteSession("session-1");
        
        // Then
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(sessionService).deleteSession("session-1");
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
