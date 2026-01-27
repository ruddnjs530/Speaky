package org.speaky.serversc.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.speaky.serversc.domain.SessionStatus;
import org.speaky.serversc.dto.*;
import org.speaky.serversc.service.SessionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * SessionController 통합 테스트
 * 
 * @WebMvcTest로 Controller 레이어만 테스트
 */
@WebMvcTest(SessionController.class)
class SessionControllerTest {
    
    @Autowired
    private MockMvc mockMvc;
    
    @Autowired
    private ObjectMapper objectMapper;
    
    @MockBean
    private SessionService sessionService;
    
    // =========================================================================
    // POST /api/sessions - 세션 생성
    // =========================================================================
    
    @Test
    @DisplayName("세션 생성 성공")
    void createSession_Success() throws Exception {
        // Given
        CreateSessionRequest request = new CreateSessionRequest();
        request.setHostUserId(1L);
        request.setVoiceModelId(100L);
        request.setTitle("Test Session");
        
        var session = TestDataFactory.createSession("session-1", 1L, 100L, "Test Session");
        when(sessionService.createSession(1L, 100L, "Test Session"))
                .thenReturn(session);
        
        // When & Then
        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sessionId").value("session-1"))
                .andExpect(jsonPath("$.hostUserId").value(1))
                .andExpect(jsonPath("$.title").value("Test Session"))
                .andExpect(jsonPath("$.status").value("STARTING"));
        
        verify(sessionService).createSession(1L, 100L, "Test Session");
    }
    
    @Test
    @DisplayName("세션 생성 실패 - Validation 오류")
    void createSession_ValidationError() throws Exception {
        // Given - hostUserId 누락
        CreateSessionRequest request = new CreateSessionRequest();
        request.setVoiceModelId(100L);
        request.setTitle("Test Session");
        
        // When & Then
        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
        
        verify(sessionService, never()).createSession(anyLong(), anyLong(), anyString());
    }
    
    // =========================================================================
    // GET /api/sessions/{sessionId} - 세션 조회
    // =========================================================================
    
    @Test
    @DisplayName("세션 조회 성공")
    void getSession_Success() throws Exception {
        // Given
        var session = TestDataFactory.createSession("session-1", 1L, 100L, "Test Session");
        when(sessionService.getSession("session-1"))
                .thenReturn(Optional.of(session));
        
        // When & Then
        mockMvc.perform(get("/api/sessions/session-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value("session-1"))
                .andExpect(jsonPath("$.hostUserId").value(1));
        
        verify(sessionService).getSession("session-1");
    }
    
    @Test
    @DisplayName("세션 조회 실패 - 존재하지 않음")
    void getSession_NotFound() throws Exception {
        // Given
        when(sessionService.getSession("non-existent"))
                .thenReturn(Optional.empty());
        
        // When & Then
        mockMvc.perform(get("/api/sessions/non-existent"))
                .andExpect(status().isNotFound());
        
        verify(sessionService).getSession("non-existent");
    }
    
    // =========================================================================
    // GET /api/sessions/host/{hostUserId} - 호스트별 세션 목록 조회
    // =========================================================================
    
    @Test
    @DisplayName("호스트별 세션 목록 조회 성공")
    void getSessionsByHost_Success() throws Exception {
        // Given
        var session1 = TestDataFactory.createSession("session-1", 1L, 100L, "Session 1");
        var session2 = TestDataFactory.createSession("session-2", 1L, 101L, "Session 2");
        
        when(sessionService.getSessionsByHostUserId(1L))
                .thenReturn(List.of(session1, session2));
        
        // When & Then
        mockMvc.perform(get("/api/sessions/host/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].sessionId").value("session-1"))
                .andExpect(jsonPath("$[1].sessionId").value("session-2"));
        
        verify(sessionService).getSessionsByHostUserId(1L);
    }
    
    // =========================================================================
    // GET /api/sessions/status/{status} - 상태별 세션 목록 조회
    // =========================================================================
    
    @Test
    @DisplayName("상태별 세션 목록 조회 성공")
    void getSessionsByStatus_Success() throws Exception {
        // Given
        var session = TestDataFactory.createLiveSession("session-1", 1L);
        
        when(sessionService.getSessionsByStatus(SessionStatus.LIVE))
                .thenReturn(List.of(session));
        
        // When & Then
        mockMvc.perform(get("/api/sessions/status/LIVE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].status").value("LIVE"));
        
        verify(sessionService).getSessionsByStatus(SessionStatus.LIVE);
    }
    
    // =========================================================================
    // POST /api/sessions/{sessionId}/start - 방송 시작
    // =========================================================================
    
    @Test
    @DisplayName("방송 시작 성공")
    void startBroadcast_Success() throws Exception {
        // Given
        StartBroadcastRequest request = new StartBroadcastRequest();
        request.setMediaServerId("media-server-1");
        request.setPipelineId("pipeline-1");
        
        var session = TestDataFactory.createLiveSession("session-1", 1L);
        when(sessionService.startBroadcast("session-1", "media-server-1", "pipeline-1"))
                .thenReturn(Optional.of(session));
        
        // When & Then
        mockMvc.perform(post("/api/sessions/session-1/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value("session-1"))
                .andExpect(jsonPath("$.status").value("LIVE"));
        
        verify(sessionService).startBroadcast("session-1", "media-server-1", "pipeline-1");
    }
    
    @Test
    @DisplayName("방송 시작 실패 - Validation 오류")
    void startBroadcast_ValidationError() throws Exception {
        // Given - mediaServerId 누락
        StartBroadcastRequest request = new StartBroadcastRequest();
        request.setPipelineId("pipeline-1");
        
        // When & Then
        mockMvc.perform(post("/api/sessions/session-1/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
        
        verify(sessionService, never()).startBroadcast(anyString(), anyString(), anyString());
    }
    
    @Test
    @DisplayName("방송 시작 실패 - 세션 없음")
    void startBroadcast_SessionNotFound() throws Exception {
        // Given
        StartBroadcastRequest request = new StartBroadcastRequest();
        request.setMediaServerId("media-server-1");
        request.setPipelineId("pipeline-1");
        
        when(sessionService.startBroadcast("non-existent", "media-server-1", "pipeline-1"))
                .thenReturn(Optional.empty());
        
        // When & Then
        mockMvc.perform(post("/api/sessions/non-existent/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }
    
    // =========================================================================
    // POST /api/sessions/{sessionId}/end - 방송 종료
    // =========================================================================
    
    @Test
    @DisplayName("방송 종료 성공")
    void endBroadcast_Success() throws Exception {
        // Given
        EndBroadcastRequest request = new EndBroadcastRequest();
        request.setReason("Host ended the broadcast");
        
        var session = TestDataFactory.createEndedSession("session-1", 1L);
        when(sessionService.endBroadcast("session-1", "Host ended the broadcast"))
                .thenReturn(Optional.of(session));
        
        // When & Then
        mockMvc.perform(post("/api/sessions/session-1/end")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value("session-1"))
                .andExpect(jsonPath("$.status").value("ENDED"));
        
        verify(sessionService).endBroadcast("session-1", "Host ended the broadcast");
    }
    
    // =========================================================================
    // POST /api/sessions/{sessionId}/fail - 방송 실패
    // =========================================================================
    
    @Test
    @DisplayName("방송 실패 처리 성공")
    void failBroadcast_Success() throws Exception {
        // Given
        EndBroadcastRequest request = new EndBroadcastRequest();
        request.setReason("Network error");
        
        var session = TestDataFactory.createFailedSession("session-1", 1L);
        when(sessionService.failBroadcast("session-1", "Network error"))
                .thenReturn(Optional.of(session));
        
        // When & Then
        mockMvc.perform(post("/api/sessions/session-1/fail")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value("session-1"))
                .andExpect(jsonPath("$.status").value("FAILED"));
        
        verify(sessionService).failBroadcast("session-1", "Network error");
    }
    
    // =========================================================================
    // DELETE /api/sessions/{sessionId} - 세션 삭제
    // =========================================================================
    
    @Test
    @DisplayName("세션 삭제 성공")
    void deleteSession_Success() throws Exception {
        // Given
        doNothing().when(sessionService).deleteSession("session-1");
        
        // When & Then
        mockMvc.perform(delete("/api/sessions/session-1"))
                .andExpect(status().isNoContent());
        
        verify(sessionService).deleteSession("session-1");
    }
    
    // =========================================================================
    // Test Data Factory
    // =========================================================================
    
    static class TestDataFactory {
        
        static org.speaky.serversc.domain.SessionEntity createSession(
                String sessionId, Long hostUserId, Long voiceModelId, String title) {
            return org.speaky.serversc.domain.SessionEntity.builder()
                    .sessionId(sessionId)
                    .hostUserId(hostUserId)
                    .voiceModelId(voiceModelId)
                    .title(title)
                    .status(SessionStatus.STARTING)
                    .createdAt(java.time.LocalDateTime.now())
                    .build();
        }
        
        static org.speaky.serversc.domain.SessionEntity createLiveSession(
                String sessionId, Long hostUserId) {
            return org.speaky.serversc.domain.SessionEntity.builder()
                    .sessionId(sessionId)
                    .hostUserId(hostUserId)
                    .voiceModelId(100L)
                    .title("Live Session")
                    .status(SessionStatus.LIVE)
                    .mediaServerId("media-server-1")
                    .pipelineId("pipeline-1")
                    .startedAt(java.time.LocalDateTime.now())
                    .createdAt(java.time.LocalDateTime.now().minusSeconds(60))
                    .build();
        }
        
        static org.speaky.serversc.domain.SessionEntity createEndedSession(
                String sessionId, Long hostUserId) {
            return org.speaky.serversc.domain.SessionEntity.builder()
                    .sessionId(sessionId)
                    .hostUserId(hostUserId)
                    .voiceModelId(100L)
                    .title("Ended Session")
                    .status(SessionStatus.ENDED)
                    .mediaServerId("media-server-1")
                    .pipelineId("pipeline-1")
                    .startedAt(java.time.LocalDateTime.now().minusSeconds(300))
                    .endedAt(java.time.LocalDateTime.now())
                    .endedReason("Host ended the broadcast")
                    .createdAt(java.time.LocalDateTime.now().minusSeconds(360))
                    .build();
        }
        
        static org.speaky.serversc.domain.SessionEntity createFailedSession(
                String sessionId, Long hostUserId) {
            return org.speaky.serversc.domain.SessionEntity.builder()
                    .sessionId(sessionId)
                    .hostUserId(hostUserId)
                    .voiceModelId(100L)
                    .title("Failed Session")
                    .status(SessionStatus.FAILED)
                    .mediaServerId("media-server-1")
                    .pipelineId("pipeline-1")
                    .startedAt(java.time.LocalDateTime.now().minusSeconds(300))
                    .endedAt(java.time.LocalDateTime.now())
                    .endedReason("Network error")
                    .createdAt(java.time.LocalDateTime.now().minusSeconds(360))
                    .build();
        }
    }
}
