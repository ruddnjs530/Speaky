package core

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/pion/webrtc/v4"

	// "speaky-media/internal/pipeline" // Not used directly in Session yet, but imported
	media_sync "speaky-media/internal/sync"
)

// Session wraps a webrtc.PeerConnection with user context.
// It manages the lifecycle of a single participant in a room.
type Session struct {
	ID           string
	pc           *webrtc.PeerConnection
	room         *Room
	localTracks  map[string]*webrtc.TrackLocalStaticRTP
	mu           sync.Mutex
	ctx          context.Context
	cancel       context.CancelFunc
	Synchronizer *media_sync.Synchronizer // Manages AV sync for this session's ingest
}

// NewSession creates a new session for a participant.
// It registers event handlers (OnTrack, OnICEConnectionStateChange) before SDP exchange.
func NewSession(id string, room *Room, pc *webrtc.PeerConnection) *Session {
	ctx, cancel := context.WithCancel(room.ctx)

	session := &Session{
		ID:           id,
		pc:           pc,
		room:         room,
		localTracks:  make(map[string]*webrtc.TrackLocalStaticRTP),
		ctx:          ctx,
		cancel:       cancel,
		Synchronizer: media_sync.NewSynchronizer(),
	}

	// Register OnTrack handler to forward incoming tracks to the room
	// CRITICAL: This callback runs on Pion's internal goroutine.
	// BroadcastTrack MUST NOT block or hold locks for extended periods.
	pc.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		slog.Info("Track received",
			"sessionID", id,
			"trackID", track.ID(),
			"kind", track.Kind().String(),
		)

		// Forward track to room for broadcasting (will be implemented in room.go)
		if err := room.BroadcastTrack(id, track, session.ctx); err != nil {
			slog.Error("Failed to broadcast track", "error", err)
		}
	})

	// Register ICE connection state handler
	pc.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		msg := fmt.Sprintf("ICE Connection State changed: %s", state.String())

		switch state {
		case webrtc.ICEConnectionStateFailed, webrtc.ICEConnectionStateDisconnected:
			slog.Warn(msg, "sessionID", id)
		case webrtc.ICEConnectionStateClosed:
			slog.Debug(msg, "sessionID", id)
		default:
			slog.Info(msg, "sessionID", id)
		}
	})

	return session
}

// HandleOffer processes an SDP offer and returns an SDP answer.
func (s *Session) HandleOffer(offerSDP string) (string, error) {
	// Set remote description (offer)
	if err := s.pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  offerSDP,
	}); err != nil {
		return "", fmt.Errorf("failed to set remote description: %w", err)
	}

	// Create answer
	answer, err := s.pc.CreateAnswer(nil)
	if err != nil {
		return "", fmt.Errorf("failed to create answer: %w", err)
	}

	// Set local description (answer)
	if err := s.pc.SetLocalDescription(answer); err != nil {
		return "", fmt.Errorf("failed to set local description: %w", err)
	}

	return answer.SDP, nil
}

// AddICECandidate adds an ICE candidate to the peer connection.
func (s *Session) AddICECandidate(candidate webrtc.ICECandidateInit) error {
	if err := s.pc.AddICECandidate(candidate); err != nil {
		return fmt.Errorf("failed to add ICE candidate: %w", err)
	}
	return nil
}

// AddLocalTrack stores a local track for this session.
// This is used to track which tracks are being sent to this participant.
func (s *Session) AddLocalTrack(trackID string, track *webrtc.TrackLocalStaticRTP) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.localTracks[trackID] = track
}

// RemoveLocalTrack removes a local track from this session.
// This should be called when a track is closed to prevent memory leaks.
func (s *Session) RemoveLocalTrack(trackID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.localTracks, trackID)
}

// Close gracefully shuts down the session and cleans up resources.
// It cancels the context to stop all copyTrack goroutines.
func (s *Session) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Cancel context to stop all child goroutines
	s.cancel()

	// Close the peer connection
	if err := s.pc.Close(); err != nil {
		return fmt.Errorf("failed to close peer connection: %w", err)
	}

	// Clear local tracks
	s.localTracks = make(map[string]*webrtc.TrackLocalStaticRTP)

	return nil
}

// PeerConnection returns the underlying WebRTC peer connection.
// This is exposed for testing and advanced use cases.
func (s *Session) PeerConnection() *webrtc.PeerConnection {
	return s.pc
}
