package org.speaky.serversc.client;

import io.grpc.ManagedChannel;
import io.grpc.StatusRuntimeException;
import lombok.extern.slf4j.Slf4j;
import org.speaky.serversc.exception.MediaServerException;
import org.speaky.serversc.grpc.*;
import org.springframework.stereotype.Service;

/**
 * Media Server gRPC 클라이언트
 * 
 * ManagedChannel은 GrpcConfig에서 Bean으로 주입받아 사용합니다.
 */
@Slf4j
@Service
public class MediaServerClient {

    private final MediaControlServiceGrpc.MediaControlServiceBlockingStub blockingStub;

    /**
     * GrpcConfig에서 생성된 ManagedChannel을 주입받습니다.
     */
    public MediaServerClient(ManagedChannel channel) {
        log.info("Initializing MediaServerClient with injected channel");
        this.blockingStub = MediaControlServiceGrpc.newBlockingStub(channel);
    }

    /**
     * Room 생성 (세션 시작 시)
     */
    public void createRoom(String sessionId, String hostId, String voiceProfileId) {
        log.info("Call CreateRoom: sessionId={}, hostId={}, voiceProfileId={}", sessionId, hostId, voiceProfileId);

        CreateRoomRequest.Builder builder = CreateRoomRequest.newBuilder()
                .setRoomId(sessionId)
                .setHostId(hostId);

        if (voiceProfileId != null) {
            builder.setVoiceProfileId(voiceProfileId);
        }

        CreateRoomRequest request = builder.build();

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
     * Voice Profile 생성
     */
    public VoiceProfile createProfile(Long voiceModelId, float pitchScale) {
        log.info("Call CreateProfile: voiceModelId={}, pitchScale={}", voiceModelId, pitchScale);
        CreateProfileRequest request = CreateProfileRequest.newBuilder()
                .setVoiceModelId(voiceModelId)
                .setPitchScale(pitchScale)
                .build();

        try {
            VoiceProfile profile = blockingStub.createProfile(request);
            log.info("CreateProfile success: profileId={}", profile.getId());
            return profile;
        } catch (StatusRuntimeException e) {
            log.error("CreateProfile failed: {}", e.getStatus());
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
     * 
     * 실패 시에도 예외를 던져서 상위에서 명시적으로 처리하도록 합니다.
     */
    public void deleteRoom(String sessionId) {
        log.info("Call DeleteRoom: sessionId={}", sessionId);
        DeleteRoomRequest request = DeleteRoomRequest.newBuilder()
                .setRoomId(sessionId)
                .build();
        
        try {
            DeleteRoomResponse response = blockingStub.deleteRoom(request);
            if (!response.getSuccess()) {
                throw new MediaServerException("DELETE_ROOM_FAILED", "Media server returned failure for sessionId=" + sessionId);
            }
            log.info("DeleteRoom success: sessionId={}", sessionId);
        } catch (StatusRuntimeException e) {
            log.error("DeleteRoom failed: {}", e.getStatus());
            throw new MediaServerException(e);
        }
    }

    /**
     * ICE Candidate 전달
     * 
     * 실패 시 예외를 던져서 일관성을 유지합니다.
     * 상위 서비스(SignalingService)에서 비치명적 에러로 처리할 수 있습니다.
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
                throw new MediaServerException("ICE_SUBMIT_FAILED", "Media server returned failure for ICE candidate");
            }
            log.debug("SubmitIceCandidate success");
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
     * Room을 나감 (사용자 연결 종료)
     */
    public void leaveRoom(String sessionId, String userId) {
        log.info("Call LeaveRoom: sessionId={}, userId={}", sessionId, userId);
        LeaveRoomRequest request = LeaveRoomRequest.newBuilder()
                .setRoomId(sessionId)
                .setUserId(userId)
                .build();

        try {
            LeaveRoomResponse response = blockingStub.leaveRoom(request);
            if (!response.getSuccess()) {
                throw new MediaServerException("LEAVE_ROOM_FAILED", "Media server returned failure");
            }
            log.info("LeaveRoom success: sessionId={}, userId={}", sessionId, userId);
        } catch (StatusRuntimeException e) {
            log.error("LeaveRoom failed: {}", e.getStatus());
            throw new MediaServerException(e);
        }
    }

    /**
     * 세션 설정 변경 (음성 변조 등)
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
            log.info("UpdateSessionConfig success");
        } catch (StatusRuntimeException e) {
            log.error("UpdateSessionConfig failed: {}", e.getStatus());
            throw new MediaServerException(e);
        }
    }
}
