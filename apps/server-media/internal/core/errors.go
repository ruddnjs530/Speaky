package core

import "errors"

var (
	// Room Errors
	ErrRoomNotFound      = errors.New("room not found")
	ErrRoomAlreadyExists = errors.New("room already exists")

	// Session Errors
	ErrSessionNotFound      = errors.New("session not found")
	ErrSessionAlreadyExists = errors.New("session already exists")
	ErrSessionClosed        = errors.New("session closed")

	// WebRTC & Signaling Errors
	// ErrInvalidSDP indicates that the provided SDP offer could not be processed.
	ErrInvalidSDP = errors.New("invalid SDP offer")
	// ErrICEGatheringTimeout indicates that the ICE gathering process took too long.
	ErrICEGatheringTimeout = errors.New("ICE gathering timed out")
	// ErrPeerConnectionFailed indicates a fatal error in creating or managing the WebRTC PeerConnection.
	ErrPeerConnectionFailed = errors.New("peer connection failed")
)
