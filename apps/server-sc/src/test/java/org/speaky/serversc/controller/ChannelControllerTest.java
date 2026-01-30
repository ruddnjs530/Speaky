package org.speaky.serversc.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.speaky.serversc.domain.SessionEntity;
import org.speaky.serversc.domain.SessionStatus;
import org.speaky.serversc.dto.ChannelStateResponse;
import org.speaky.serversc.repository.SessionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * ChannelController 단위 테스트
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannelController Unit Tests")
class ChannelControllerTest {
    
    @Mock
    private SessionRepository sessionRepository;
    
    @InjectMocks
    private ChannelController channelController;
    
    @Test
    @DisplayName("채널 상태 조회 성공 - LIVE 세션 있음")
    void getChannelState_WithLiveSession() {
        // Given
        String channelId = "ch_user_faker";
        SessionEntity liveSession = SessionEntity.builder()
                .sessionId("session-123")
                .channelId(channelId)
                .hostUserId(1L)
                .status(SessionStatus.LIVE)
                .title("Live Session")
                .createdAt(LocalDateTime.now())
                .build();
        
        when(sessionRepository.findByChannelIdAndStatus(channelId, SessionStatus.LIVE))
                .thenReturn(Optional.of(liveSession));
        
        // When
        ResponseEntity<ChannelStateResponse> response = channelController.getChannelState(channelId);
        
        // Then
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getHostLoginId()).isEqualTo("faker");
        assertThat(response.getBody().getActiveSessionId()).isEqualTo("session-123");
        
        verify(sessionRepository).findByChannelIdAndStatus(channelId, SessionStatus.LIVE);
    }
    
    @Test
    @DisplayName("채널 상태 조회 성공 - LIVE 세션 없음")
    void getChannelState_WithoutLiveSession() {
        // Given
        String channelId = "ch_user_faker";
        when(sessionRepository.findByChannelIdAndStatus(channelId, SessionStatus.LIVE))
                .thenReturn(Optional.empty());
        
        // When
        ResponseEntity<ChannelStateResponse> response = channelController.getChannelState(channelId);
        
        // Then
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getHostLoginId()).isEqualTo("faker");
        assertThat(response.getBody().getActiveSessionId()).isNull();
        
        verify(sessionRepository).findByChannelIdAndStatus(channelId, SessionStatus.LIVE);
    }
}
