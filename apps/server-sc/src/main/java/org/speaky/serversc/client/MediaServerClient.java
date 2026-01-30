package org.speaky.serversc.client;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.exception.MediaServerException;
import org.speaky.serversc.grpc.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class MediaServerClient {

    private final ManagedChannel channel;
    private final MediaControlServiceGrpc.MediaControlServiceBlockingStub blockingStub;

    public MediaServerClient(@Value("${media.server.host:localhost}") String host,
                             @Value("${media.server.port:8081}") int port) {
        log.info("Connecting to Media Server at {}:{}", host, port);
        this.channel = ManagedChannelBuilder.forAddress(host, port)
                .usePlaintext() // 개발/테스트용 (SSL 미사용)
                .build();
        this.blockingStub = MediaControlServiceGrpc.newBlockingStub(channel);
    }

    /**
     * Room 생성 (세션 시작 시)
     */
    public void createRoom(String sessionId, String hostId) {
        log.info("Call CreateRoom: sessionId={}, hostId={}", sessionId, hostId);
        CreateRoomRequest request = CreateRoomRequest.newBuilder()
                .setRoomId(sessionId)
                .setHostId(hostId)
                .build();

        try {
            CreateRoomResponse response = blockingStub.createRoom(request);
            if (!response.getSuccess()) {
                throw new MediaServerException("CREATE_ROOM_FAILED", "Media server returned failure");
            }
            log.info("CreateRoom success: roomId={}", response.getRoomId());
        } catch (StatusRuntimeException e) {
            log.error("CreateRoom failed: {}", e.getStatus());
            throw new MediaServerException(e);
        }
    }

    /**
     * Room 참여 (Signaling) - SDP Offer 전달 및 Answer 수신
     */
    public String joinRoom(String sessionId, String userId, String sdpOffer) {
        log.info("Call JoinRoom: sessionId={}, userId={}", sessionId, userId);
        JoinRoomRequest request = JoinRoomRequest.newBuilder()
                .setRoomId(sessionId)
                .setUserId(userId)
                .setSdpOffer(sdpOffer)
                .build();

        try {
            JoinRoomResponse response = blockingStub.joinRoom(request);
            return response.getSdpAnswer();
        } catch (StatusRuntimeException e) {
            log.error("JoinRoom failed: {}", e.getStatus());
            throw new MediaServerException(e);
        }
    }

    /**
     * Room 삭제 (세션 종료 시)
     */
    public void deleteRoom(String sessionId) {
        log.info("Call DeleteRoom: sessionId={}", sessionId);
        DeleteRoomRequest request = DeleteRoomRequest.newBuilder()
                .setRoomId(sessionId)
                .build();
        
        try {
            DeleteRoomResponse response = blockingStub.deleteRoom(request);
            if (!response.getSuccess()) {
                log.warn("DeleteRoom returned failure for sessionId={}", sessionId);
            }
        } catch (StatusRuntimeException e) {
            log.error("DeleteRoom failed: {}", e.getStatus());
            // 삭제 실패는 치명적이지 않으므로 예외를 던지지 않음 (or throw if needed)
        }
    }

    /**
     * ICE Candidate 전달
     */
    public void submitIceCandidate(String sessionId, String userId, String candidate, String sdpMid, int sdpMLineIndex) {
        log.debug("Call SubmitIceCandidate: sessionId={}, userId={}", sessionId, userId);
        SubmitIceCandidateRequest request = SubmitIceCandidateRequest.newBuilder()
                .setRoomId(sessionId)
                .setUserId(userId)
                .setCandidate(candidate)
                .setSdpMid(sdpMid != null ? sdpMid : "")
                .setSdpMLineIndex(sdpMLineIndex)
                .build();

        try {
            SubmitIceCandidateResponse response = blockingStub.submitIceCandidate(request);
            if (!response.getSuccess()) {
                log.warn("SubmitIceCandidate returned failure");
            }
        } catch (StatusRuntimeException e) {
            log.error("SubmitIceCandidate failed: {}", e.getStatus());
            throw new MediaServerException(e);
        }
    }

    /**
     * Renegotiate (트랙 변경 등)
     */
    public String renegotiate(String sessionId, String userId, String sdpOffer) {
        log.info("Call Renegotiate: sessionId={}, userId={}", sessionId, userId);
        RenegotiateRequest request = RenegotiateRequest.newBuilder()
                .setRoomId(sessionId)
                .setUserId(userId)
                .setSdpOffer(sdpOffer)
                .build();

        try {
            RenegotiateResponse response = blockingStub.renegotiate(request);
            return response.getSdpAnswer();
        } catch (StatusRuntimeException e) {
            log.error("Renegotiate failed: {}", e.getStatus());
            throw new MediaServerException(e);
        }
    }

    /**
     * 서비스 설정 변경 (음성 변조 등)
     */
    public void updateSessionConfig(String sessionId, String voiceModelId, float pitchScale) {
        log.info("Call UpdateSessionConfig: sessionId={}, voiceModelId={}, pitchScale={}", sessionId, voiceModelId, pitchScale);
        UpdateSessionConfigRequest request = UpdateSessionConfigRequest.newBuilder()
                .setRoomId(sessionId)
                .setVoiceModelId(voiceModelId)
                .setPitchScale(pitchScale)
                .build();

        try {
            UpdateSessionConfigResponse response = blockingStub.updateSessionConfig(request);
            if (!response.getSuccess()) {
                throw new MediaServerException("UPDATE_CONFIG_FAILED", "Media server returned failure");
            }
        } catch (StatusRuntimeException e) {
            log.error("UpdateSessionConfig failed: {}", e.getStatus());
            throw new MediaServerException(e);
        }
    }

    @PreDestroy
    public void shutdown() {
        if (channel != null && !channel.isShutdown()) {
            try {
                channel.shutdown().awaitTermination(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
