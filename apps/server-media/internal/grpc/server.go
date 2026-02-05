package grpc

import (
	"context"
	"errors"
	"log/slog"

	"speaky-media/internal/core"
	pb "mediaserver/proto"

	"github.com/pion/webrtc/v4"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// MediaServiceServer implements the ControlService gRPC interface.
type MediaServiceServer struct {
	pb.UnimplementedMediaControlServiceServer
	manager *core.Manager
}

// NewServer creates a new MediaServiceServer.
func NewServer(manager *core.Manager) *MediaServiceServer {
	return &MediaServiceServer{
		manager: manager,
	}
}

// CreateRoom creates a new room.
func (s *MediaServiceServer) CreateRoom(ctx context.Context, req *pb.CreateRoomRequest) (*pb.CreateRoomResponse, error) {
	roomID := req.RoomId
	if roomID == "" {
		return nil, status.Error(codes.InvalidArgument, "room_id is required")
	}
	hostID := req.HostId
	voiceProfileID := req.VoiceProfileId

	room, err := s.manager.GetOrCreateRoom(roomID, hostID, voiceProfileID)
	if err != nil {
		return nil, mapErrorToGRPC(err)
	}

	return &pb.CreateRoomResponse{
		Success: true,
		RoomId:  room.ID,
	}, nil
}

// CreateProfile creates a new voice profile.
func (s *MediaServiceServer) CreateProfile(ctx context.Context, req *pb.CreateProfileRequest) (*pb.VoiceProfile, error) {
	voiceModelID := req.VoiceModelId
	pitchScale := req.PitchScale

	// Basic validation
	if voiceModelID <= 0 {
		return nil, status.Error(codes.InvalidArgument, "invalid voice_model_id")
	}

	profile := s.manager.CreateProfile(voiceModelID, pitchScale)

	return &pb.VoiceProfile{
		Id:           profile.ID,
		VoiceModelId: profile.VoiceModelID,
		PitchScale:   profile.PitchScale,
	}, nil
}

// DeleteRoom destroys a media room.
func (s *MediaServiceServer) DeleteRoom(ctx context.Context, req *pb.DeleteRoomRequest) (*pb.DeleteRoomResponse, error) {
	slog.Info("DeleteRoom called", "roomID", req.RoomId)

	if err := s.manager.DeleteRoom(req.RoomId); err != nil {
		return &pb.DeleteRoomResponse{Success: false}, mapErrorToGRPC(err)
	}

	return &pb.DeleteRoomResponse{Success: true}, nil
}

// JoinRoom handles the WebRTC signaling to join a room.
func (s *MediaServiceServer) JoinRoom(ctx context.Context, req *pb.JoinRoomRequest) (*pb.JoinRoomResponse, error) {
	slog.Info("JoinRoom called", "roomID", req.RoomId, "userID", req.UserId)

	answerSDP, err := s.manager.Join(req.RoomId, req.UserId, req.SdpOffer)
	if err != nil {
		return nil, mapErrorToGRPC(err)
	}

	return &pb.JoinRoomResponse{
		SdpAnswer: answerSDP,
	}, nil
}

// Renegotiate handles adding tracks or changing media state after joining.
func (s *MediaServiceServer) Renegotiate(ctx context.Context, req *pb.RenegotiateRequest) (*pb.RenegotiateResponse, error) {
	slog.Info("Renegotiate called", "roomID", req.RoomId, "userID", req.UserId)

	answerSDP, err := s.manager.Renegotiate(req.RoomId, req.UserId, req.SdpOffer)
	if err != nil {
		return nil, mapErrorToGRPC(err)
	}

	return &pb.RenegotiateResponse{
		SdpAnswer: answerSDP,
	}, nil
}

// SubmitIceCandidate handles Trickle ICE from client -> server.
func (s *MediaServiceServer) SubmitIceCandidate(ctx context.Context, req *pb.SubmitIceCandidateRequest) (*pb.SubmitIceCandidateResponse, error) {
	// Step 1: Find Room
	room, err := s.manager.GetRoom(req.RoomId)
	if err != nil {
		return &pb.SubmitIceCandidateResponse{Success: false}, mapErrorToGRPC(err)
	}

	// Step 2: Find Session
	session, exists := room.GetSession(req.UserId)
	if !exists {
		return &pb.SubmitIceCandidateResponse{Success: false}, status.Error(codes.NotFound, "session not found")
	}

	// Pion's AddICECandidate expects Init struct
	// Safe conversion for SDPMLineIndex
	var sdpMLineIndex *uint16
	if req.SdpMLineIndex >= 0 {
		val := uint16(req.SdpMLineIndex)
		sdpMLineIndex = &val
	}

	candidate := webrtc.ICECandidateInit{
		Candidate:     req.Candidate,
		SDPMid:        &req.SdpMid,
		SDPMLineIndex: sdpMLineIndex,
	}

	if err := session.AddICECandidate(candidate); err != nil {
		slog.Warn("Failed to add ICE candidate", "error", err)
		return &pb.SubmitIceCandidateResponse{Success: false}, status.Errorf(codes.Internal, "failed to add ICE candidate: %v", err)
	}

	return &pb.SubmitIceCandidateResponse{Success: true}, nil
}

// LeaveRoom handles user departure.
func (s *MediaServiceServer) LeaveRoom(ctx context.Context, req *pb.LeaveRoomRequest) (*pb.LeaveRoomResponse, error) {
	if err := s.manager.Leave(req.RoomId, req.UserId); err != nil {
		slog.Warn("LeaveRoom failed", "error", err)
		// Leave failure is often ignored, but we can return error if strictly needed
		return &pb.LeaveRoomResponse{Success: false}, mapErrorToGRPC(err)
	}
	return &pb.LeaveRoomResponse{Success: true}, nil
}

// UpdateSessionConfig updates the AI configuration for the host in the room.
func (s *MediaServiceServer) UpdateSessionConfig(ctx context.Context, req *pb.UpdateSessionConfigRequest) (*pb.UpdateSessionConfigResponse, error) {
	slog.Info("UpdateSessionConfig called", "roomID", req.RoomId)

	room, err := s.manager.GetRoom(req.RoomId)
	if err != nil {
		return &pb.UpdateSessionConfigResponse{Success: false}, mapErrorToGRPC(err)
	}

	// Delegate to room to update host settings
	if err := room.UpdateHostSessionConfig(req.VoiceModelId, req.PitchScale); err != nil {
		return &pb.UpdateSessionConfigResponse{Success: false}, mapErrorToGRPC(err)
	}

	return &pb.UpdateSessionConfigResponse{Success: true}, nil
}

// -----------------------------------------------------------------------------
// Helper: Error Mapping
// -----------------------------------------------------------------------------

// mapErrorToGRPC converts internal core errors to standard gRPC status codes.
func mapErrorToGRPC(err error) error {
	if err == nil {
		return nil
	}

	// Check against known core errors
	switch {
	case errors.Is(err, core.ErrRoomNotFound):
		return status.Error(codes.NotFound, "room not found")
	case errors.Is(err, core.ErrRoomAlreadyExists):
		return status.Error(codes.AlreadyExists, "room already exists")
	case errors.Is(err, core.ErrSessionNotFound):
		return status.Error(codes.NotFound, "session not found")
	case errors.Is(err, core.ErrSessionAlreadyExists):
		return status.Error(codes.AlreadyExists, "session already exists")
	case errors.Is(err, core.ErrSessionClosed):
		return status.Error(codes.FailedPrecondition, "session is closed")
	case errors.Is(err, core.ErrInvalidSDP):
		return status.Error(codes.InvalidArgument, "invalid SDP offer")
	case errors.Is(err, core.ErrICEGatheringTimeout):
		return status.Error(codes.DeadlineExceeded, "ICE gathering timeout")
	case errors.Is(err, core.ErrPeerConnectionFailed):
		return status.Error(codes.Internal, "peer connection failed")
	default:
		// Log the internal error for debugging, but return generic error to client
		slog.Error("Internal gRPC Error", "error", err)
		return status.Errorf(codes.Internal, "internal server error: %v", err)
	}
}