package control_test

import (
	"context"
	"strings"
	"testing"

	"github.com/pion/webrtc/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "mediaserver/proto"

	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/control"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/media"
)

func setupHandler(t *testing.T) (*control.Handler, *media.RoomManager) {
	// Start Mock AI Server
	addr, stop := startMockVoiceServer(t)
	t.Cleanup(stop) // Ensure it stops after test

	cfg := &config.Config{
		WebRTCMinPort:   60000,
		WebRTCMaxPort:   60050,
		AudioChannels:   2,
		AudioSampleRate: 48000,
		PCMBufferSize:   100,
		AIServerAddr:    addr,
		STUNServer:      "stun:stun.l.google.com:19302",
	}
	manager, err := media.NewRoomManager(cfg)
	require.NoError(t, err)

	return control.NewHandler(manager), manager
}

// generateValidSDPOffer creates a valid SDP Offer using Pion WebRTC.
func generateValidSDPOffer(t *testing.T) string {
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)

	// Add a Transceiver or DataChannel to trigger meaningful negotiation
	_, err = pc.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio)
	require.NoError(t, err)

	offer, err := pc.CreateOffer(nil)
	require.NoError(t, err)

	err = pc.SetLocalDescription(offer)
	require.NoError(t, err)

	return offer.SDP
}

func TestHandler_CreateRoom(t *testing.T) {
	handler, _ := setupHandler(t)
	ctx := context.Background()

	// 1. Success
	req := &pb.CreateRoomRequest{HostId: "host-1"}
	resp, err := handler.CreateRoom(ctx, req)
	require.NoError(t, err)
	assert.NotEmpty(t, resp.RoomId)

	// 2. Missing HostId
	reqInvalid := &pb.CreateRoomRequest{HostId: ""}
	respInvalid, err := handler.CreateRoom(ctx, reqInvalid)
	assert.Error(t, err)
	assert.Nil(t, respInvalid)
	assert.Equal(t, codes.InvalidArgument, status.Code(err))
}

func TestHandler_JoinRoom_Success(t *testing.T) {
	handler, manager := setupHandler(t)
	ctx := context.Background()

	// 1. Create Room
	room, _ := manager.CreateRoom("host-1")

	// 2. Generate Valid SDP
	offerSDP := generateValidSDPOffer(t)

	// 3. Join Room
	req := &pb.JoinRoomRequest{
		RoomId:   room.ID,
		UserId:   "user-happy",
		SdpOffer: offerSDP,
	}

	resp, err := handler.JoinRoom(ctx, req)
	require.NoError(t, err)
	require.NotNil(t, resp)

	// 4. Verify Answer
	assert.NotEmpty(t, resp.SdpAnswer)
	assert.True(t, strings.HasPrefix(resp.SdpAnswer, "v=0"), "SDP should start with v=0")
}

func TestHandler_JoinRoom_Validation(t *testing.T) {
	handler, _ := setupHandler(t)
	ctx := context.Background()

	// Missing Fields
	reqs := []*pb.JoinRoomRequest{
		{RoomId: "", UserId: "u1", SdpOffer: "offer"},
		{RoomId: "r1", UserId: "", SdpOffer: "offer"},
		{RoomId: "r1", UserId: "u1", SdpOffer: ""},
	}

	for _, req := range reqs {
		resp, err := handler.JoinRoom(ctx, req)
		assert.Error(t, err)
		assert.Equal(t, codes.InvalidArgument, status.Code(err))
		assert.Nil(t, resp)
	}
}

func TestHandler_JoinRoom_NotFound(t *testing.T) {
	handler, _ := setupHandler(t)
	ctx := context.Background()

	req := &pb.JoinRoomRequest{
		RoomId:   "non-existent-room",
		UserId:   "user-1",
		SdpOffer: "dummy-sdp",
	}

	resp, err := handler.JoinRoom(ctx, req)
	assert.Error(t, err)
	assert.Equal(t, codes.NotFound, status.Code(err))
	assert.Nil(t, resp)
}

func TestHandler_SubmitIceCandidate(t *testing.T) {
	handler, manager := setupHandler(t)
	ctx := context.Background()

	// 1. Create Room & Join First
	room, _ := manager.CreateRoom("host-ice")
	offerSDP := generateValidSDPOffer(t)

	joinReq := &pb.JoinRoomRequest{
		RoomId:   room.ID,
		UserId:   "user-ice",
		SdpOffer: offerSDP,
	}
	_, err := handler.JoinRoom(ctx, joinReq)
	require.NoError(t, err)

	// 2. Submit Candidate
	// We use a dummy candidate string, but it should reach the receiver logic
	// The current logic just passes it to AddICECandidate, which might fail validation
	// if the candidate string is garbage, so we should try to look like a candidate or mock if deep validation occurs.
	// Pion's AddICECandidate does validate.

	// A relatively valid looking candidate string (though content might be invalid for the session)
	validCandidateStr := "candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host"

	req := &pb.SubmitIceCandidateRequest{
		RoomId:        room.ID,
		UserId:        "user-ice",
		Candidate:     validCandidateStr,
		SdpMid:        "audio",
		SdpMLineIndex: 0,
	}

	resp, err := handler.SubmitIceCandidate(ctx, req)
	// It might error if the remote description didn't set up that m-line index or mid correctly,
	// but let's see. If it fails deeply in Pion, we adjust.
	// Actually, JoinRoom waits for gathering... but trickling happens after?
	// The server might be in a state where it accepts candidates.

	// If it fails with "OperationError" because ICE is already completed or similar, we might need to adjust expectations.
	// But let's check basic plumbing first.

	// Note: For now, if Pion rejects the candidate due to state (e.g. "remote description not set" - but we did Join),
	// it should be fine. Join sets remote description.

	require.NoError(t, err, "SubmitIceCandidate should succeed after JoinRoom")
	assert.True(t, resp.Success)
}

func TestHandler_LeaveRoom(t *testing.T) {
	handler, manager := setupHandler(t)
	ctx := context.Background()

	room, _ := manager.CreateRoom("host-1")

	req := &pb.LeaveRoomRequest{
		RoomId: room.ID,
		UserId: "user-phantom",
	}
	resp, err := handler.LeaveRoom(ctx, req)
	assert.NoError(t, err)
	assert.True(t, resp.Success)

	// Leave non-existent room
	req2 := &pb.LeaveRoomRequest{
		RoomId: "phantom-room",
		UserId: "user-phantom",
	}
	resp2, err := handler.LeaveRoom(ctx, req2)
	assert.Error(t, err) // handler.go returns NotFound if room missing
	assert.Nil(t, resp2)
}
