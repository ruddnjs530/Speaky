package core

import (
	"github.com/pion/webrtc/v4"
)

// Session wraps a webrtc.PeerConnection with user context.
// It will be fully implemented in the next step.
type Session struct {
	id string
	pc *webrtc.PeerConnection
}

// TODO: Implement Session methods (will be added in next step)
