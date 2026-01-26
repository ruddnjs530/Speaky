package webrtc

import (
	"fmt"
	"log/slog"

	"speaky-media/internal/config"

	"github.com/pion/webrtc/v4"
)

// NewPeerConnection creates a new WebRTC PeerConnection using the provided API and Config.
// It configures ICE servers (STUN/TURN) and attaches default event loggers.
func NewPeerConnection(api *webrtc.API, cfg *config.Config) (*webrtc.PeerConnection, error) {
	// 1. Configure ICE Servers
	var iceServers []webrtc.ICEServer

	// Only add STUN server if explicitly set (allows offline/local testing if empty)
	if cfg.STUNServer != "" {
		iceServers = append(iceServers, webrtc.ICEServer{
			URLs: []string{cfg.STUNServer},
		})
	}

	if cfg.TURNServer != "" {
		iceServers = append(iceServers, webrtc.ICEServer{
			URLs:           []string{cfg.TURNServer},
			Username:       cfg.TURNUsername,
			Credential:     cfg.TURNCredential,
			CredentialType: webrtc.ICECredentialTypePassword,
		})
	}

	rtcConfig := webrtc.Configuration{
		ICEServers: iceServers,
	}

	// 2. Create PeerConnection
	pc, err := api.NewPeerConnection(rtcConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create peer connection: %w", err)
	}

	// 3. Attach Event Handlers for Logging
	pc.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		msg := fmt.Sprintf("ICE Connection State changed: %s", state.String())

		if state == webrtc.ICEConnectionStateFailed {
			slog.Warn(msg) // Warn on failure
		} else {
			slog.Info(msg)
		}
	})

	pc.OnSignalingStateChange(func(state webrtc.SignalingState) {
		slog.Debug("Signaling State changed", "state", state.String())
	})

	return pc, nil
}
