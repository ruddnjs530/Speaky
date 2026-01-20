package control

import (
	"context"
	"log/slog"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "mediaserver/proto"

	"github.com/pion/webrtc/v4"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/media"
)

// Handler implements the ControlServiceServer interface.
type Handler struct {
	pb.UnimplementedControlServiceServer
	roomManager *media.RoomManager
}

// NewHandler creates a new ControlService handler.
func NewHandler(roomManager *media.RoomManager) *Handler {
	return &Handler{
		roomManager: roomManager,
	}
}

// CreateRoom creates a new conference room.
func (h *Handler) CreateRoom(ctx context.Context, req *pb.CreateRoomRequest) (*pb.CreateRoomResponse, error) {
	if req.HostId == "" {
		return nil, status.Error(codes.InvalidArgument, "host_id is required")
	}

	room, err := h.roomManager.CreateRoom(req.HostId)
	if err != nil {
		slog.Error("Failed to create room", "error", err)
		return nil, status.Error(codes.Internal, "failed to create room")
	}

	slog.Info("Room created", "room_id", room.ID, "host_id", req.HostId)

	return &pb.CreateRoomResponse{
		RoomId: room.ID,
	}, nil
}

// JoinRoom handles the WebRTC signaling for a user joining a room.
func (h *Handler) JoinRoom(ctx context.Context, req *pb.JoinRoomRequest) (*pb.JoinRoomResponse, error) {
	if req.RoomId == "" || req.UserId == "" || req.SdpOffer == "" {
		return nil, status.Error(codes.InvalidArgument, "room_id, user_id, and sdp_offer are required")
	}

	// 1. Retrieve the room
	room, err := h.roomManager.GetRoom(req.RoomId)
	if err != nil {
		// Differentiate between room not found and other errors if GetRoom returns typed errors.
		// For now, assuming any error from GetRoom means room not found.
		return nil, status.Errorf(codes.NotFound, "room not found: %s", req.RoomId)
	}

	// 2. Delegate to Room.Join (Assembly Logic)
	// This will block until ICE Gathering is complete (Vanilla ICE).
	sdpAnswer, err := room.Join(req.UserId, req.SdpOffer)
	if err != nil {
		slog.Error("Failed to join room", "room_id", req.RoomId, "user_id", req.UserId, "error", err)
		return nil, status.Errorf(codes.Internal, "failed to process join request: %v", err)
	}

	return &pb.JoinRoomResponse{
		SdpAnswer: sdpAnswer,
	}, nil
}

// SubmitIceCandidate handles Trickle ICE candidates from the client.
func (h *Handler) SubmitIceCandidate(ctx context.Context, req *pb.SubmitIceCandidateRequest) (*pb.SubmitIceCandidateResponse, error) {
	if req.RoomId == "" || req.UserId == "" || req.Candidate == "" {
		return nil, status.Error(codes.InvalidArgument, "room_id, user_id, and candidate are required")
	}

	room, err := h.roomManager.GetRoom(req.RoomId)
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "room not found: %s", req.RoomId)
	}

	// Construct webrtc.ICECandidateInit from proto request
	// Note: checking if SdpMLineIndex is actually set (0 is valid so standard proto check might differ).
	// But in proto3 scalar fields default to 0. We assume the client provides correct data.
	// We cast int32 to uint16 safely.
	var sdpMLineIndex *uint16
	if req.SdpMLineIndex >= 0 {
		val := uint16(req.SdpMLineIndex)
		sdpMLineIndex = &val
	}

	candidateInit := webrtc.ICECandidateInit{
		Candidate:     req.Candidate,
		SDPMid:        &req.SdpMid,
		SDPMLineIndex: sdpMLineIndex,
	}

	// Delegate to Room.AddICECandidate
	if err := room.AddICECandidate(req.UserId, candidateInit); err != nil {
		slog.Error("Failed to add ICE candidate", "error", err)
		return nil, status.Errorf(codes.Internal, "failed to add candidate: %v", err)
	}

	return &pb.SubmitIceCandidateResponse{Success: true}, nil
}

// LeaveRoom handles user departure and resource cleanup.
func (h *Handler) LeaveRoom(ctx context.Context, req *pb.LeaveRoomRequest) (*pb.LeaveRoomResponse, error) {
	if req.RoomId == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "room_id and user_id are required")
	}

	room, err := h.roomManager.GetRoom(req.RoomId)
	if err != nil {
		// If room is already gone, consider it a success or not found.
		// Let's say NotFound is fine, or we can return Success=true because the goal (user leaving) is met.
		// Return NotFound for correctness.
		return nil, status.Errorf(codes.NotFound, "room not found: %s", req.RoomId)
	}

	if err := room.Leave(req.UserId); err != nil {
		slog.Error("Failed to leave room", "error", err)
		// If participant not found, it's also technically a success state (they are gone).
		return &pb.LeaveRoomResponse{Success: true}, nil
	}

	return &pb.LeaveRoomResponse{Success: true}, nil
}
