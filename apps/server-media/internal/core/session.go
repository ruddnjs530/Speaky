package core

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v4"
	"time"

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
	onClosed      func()                          // Callback to notify Room when session ends
	Synchronizer  *media_sync.Synchronizer        // Manages AV sync for this session's ingest
	Role          string                          // "host" or "guest"
	dummyTrackIDs map[string]struct{}             // Set of track IDs created as dummies
	
	// ICE Candidate Buffering
	candidateQueue []webrtc.ICECandidateInit
	remoteDescSet  bool
}

// NewSession creates a new session for a participant.
// It registers event handlers (OnTrack, OnICEConnectionStateChange) before SDP exchange.
func NewSession(id string, role string, room *Room, pc *webrtc.PeerConnection, onClosed func()) *Session {
	ctx, cancel := context.WithCancel(room.ctx)

	session := &Session{
		ID:            id,
		pc:            pc,
		room:          room,
		localTracks:   make(map[string]*webrtc.TrackLocalStaticRTP),
		dummyTrackIDs: make(map[string]struct{}), // Track dummy IDs explicitly
		ctx:           ctx,
		cancel:        cancel,
		Synchronizer:  media_sync.NewSynchronizer(),
		onClosed:      onClosed,
		Role:          role,
		candidateQueue: make([]webrtc.ICECandidateInit, 0),
		remoteDescSet:  false,
	}

	// Register OnTrack handler to forward incoming tracks to the room
	// CRITICAL: This callback runs on Pion's internal goroutine.
	// BroadcastTrack MUST NOT block or hold locks for extended periods.
	pc.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		slog.Info("Track received",
			"sessionID", id,
			"role", role,
			"trackID", track.ID(),
			"kind", track.Kind().String(),
		)

		// ENFORCE ROLE: Only "host" can publish
		if role != "host" {
			slog.Warn("Guest attempted to publish track, ignoring", "userID", id)
			return
		}

		// Forward track to room for broadcasting (will be implemented in room.go)
		if err := room.BroadcastTrack(id, track, session.ctx); err != nil {
			slog.Error("Failed to broadcast track", "error", err)
		}

		// PLI Strategy: Send Picture Loss Indication every 3 seconds
		// This ensures keyframes are generated even if packet loss occurs or new subscriber joins.
		if track.Kind() == webrtc.RTPCodecTypeVideo {
			go func() {
				ticker := time.NewTicker(3 * time.Second)
				defer ticker.Stop()
				for {
					select {
					case <-session.ctx.Done():
						return
					case <-ticker.C:
						if rtcpErr := pc.WriteRTCP([]rtcp.Packet{&rtcp.PictureLossIndication{MediaSSRC: uint32(track.SSRC())}}); rtcpErr != nil {
							// Non-fatal, just log debug
						}
					}
				}
			}()
		}
	})

	// Cleanup Timer for Zombie Sessions (Disconnected state)
	var disconnectTimer *time.Timer
	var mu sync.Mutex // Protect timer access

	// Register ICE connection state handler
	pc.OnICEConnectionStateChange(func(state webrtc.ICEConnectionState) {
		msg := fmt.Sprintf("ICE Connection State changed: %s", state.String())

		mu.Lock()
		defer mu.Unlock()

		switch state {
		case webrtc.ICEConnectionStateDisconnected:
			slog.Warn(msg, "sessionID", id, "action", "starting cleanup timer")
			// Start cleanup timer (30s)
			if disconnectTimer != nil {
				disconnectTimer.Stop()
			}
			disconnectTimer = time.AfterFunc(30*time.Second, func() {
				slog.Info("Session disconnected timeout, cleaning up", "sessionID", id)
				if session.onClosed != nil {
					session.onClosed()
				}
			})

		case webrtc.ICEConnectionStateConnected, webrtc.ICEConnectionStateCompleted:
			slog.Info(msg, "sessionID", id)
			// Connection recovered, stop timer
			if disconnectTimer != nil {
				disconnectTimer.Stop()
				disconnectTimer = nil
				slog.Info("Session reconnected, cleanup timer cancelled", "sessionID", id)
			}

		case webrtc.ICEConnectionStateFailed, webrtc.ICEConnectionStateClosed:
			slog.Warn(msg, "sessionID", id)
			// Stop timer if it exists (cleanup will happen anyway)
			if disconnectTimer != nil {
				disconnectTimer.Stop()
				disconnectTimer = nil
			}
			// Trigger cleanup immediately
			if state == webrtc.ICEConnectionStateFailed || state == webrtc.ICEConnectionStateClosed {
				if session.onClosed != nil {
					go session.onClosed()
				}
			}
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
		return "", fmt.Errorf("%w: %v", ErrInvalidSDP, err)
	}

	// Flush buffered ICE candidates now that RemoteDescription is set
	s.mu.Lock()
	s.remoteDescSet = true
	for _, candidate := range s.candidateQueue {
		if err := s.pc.AddICECandidate(candidate); err != nil {
			slog.Warn("Failed to add buffered ICE candidate", "error", err)
		} else {
			slog.Debug("Added buffered ICE candidate")
		}
	}
	s.candidateQueue = nil // clear buffer
	s.mu.Unlock()

	// SSRC Allocation Strategy for ALL roles:
	// Inject "Dummy" (Silent/Black) tracks into the PeerConnection.
	// This forces Pion to allocate SSRCs and include them in the SDP Answer.
	// Without this, the SDP Answer would have no SSRC information for the empty slots,
	// causing the Client to drop future incoming media packets.
	// 
	// CRITICAL: Host also needs dummy tracks for PREVIEW functionality.
	// The dummy tracks will be replaced with actual broadcast tracks later.
	slog.Info("HandleOffer: Injecting dummy tracks to ensure SSRC allocation", "role", s.Role)

	s.mu.Lock() // Protect map access

	// Audio Dummy (Opus)
	audioCap := webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus}
	dummyAudio, err := webrtc.NewTrackLocalStaticRTP(audioCap, "dummy-audio", "dummy-stream")
	if err != nil {
		slog.Warn("Failed to create dummy audio", "error", err)
	} else {
		if _, err := s.pc.AddTrack(dummyAudio); err != nil {
			slog.Warn("Failed to add dummy audio track", "error", err)
		} else {
			s.dummyTrackIDs[dummyAudio.ID()] = struct{}{}
			slog.Debug("Added dummy audio track", "trackID", dummyAudio.ID(), "role", s.Role)
		}
	}

	// Video Dummy (VP8)
	videoCap := webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeVP8}
	dummyVideo, err := webrtc.NewTrackLocalStaticRTP(videoCap, "dummy-video", "dummy-stream")
	if err != nil {
		slog.Warn("Failed to create dummy video", "error", err)
	} else {
		if _, err := s.pc.AddTrack(dummyVideo); err != nil {
			slog.Warn("Failed to add dummy video track", "error", err)
		} else {
			s.dummyTrackIDs[dummyVideo.ID()] = struct{}{}
			slog.Debug("Added dummy video track", "trackID", dummyVideo.ID(), "role", s.Role)
		}
	}
	s.mu.Unlock()

	// Create answer
	answer, err := s.pc.CreateAnswer(nil)
	if err != nil {
		return "", fmt.Errorf("failed to create answer: %w", err)
	}

	// Create a channel to wait for ICE gathering to complete (One-Shot Signaling)
	gatherComplete := webrtc.GatheringCompletePromise(s.pc)

	// Set local description (answer)
	if err := s.pc.SetLocalDescription(answer); err != nil {
		return "", fmt.Errorf("failed to set local description: %w", err)
	}

	// Wait for gathering completion or context timeout
	select {
	case <-gatherComplete:
		slog.Info("ICE Gathering complete", "sessionID", s.ID)
	case <-s.ctx.Done():
		return "", fmt.Errorf("%w: %s", ErrICEGatheringTimeout, s.ID)
	}

	// Return the *updated* LocalDescription which now contains ALL candidates
	finalAnswer := s.pc.LocalDescription()
	return finalAnswer.SDP, nil
}

// AddICECandidate adds an ICE candidate to the peer connection.
// Supports buffering if called before RemoteDescription is set.
func (s *Session) AddICECandidate(candidate webrtc.ICECandidateInit) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.remoteDescSet {
		slog.Info("Buffering ICE candidate (RemoteDescription not set)", "sessionID", s.ID)
		s.candidateQueue = append(s.candidateQueue, candidate)
		return nil
	}

	if err := s.pc.AddICECandidate(candidate); err != nil {
		return fmt.Errorf("failed to add ICE candidate: %w", err)
	}
	slog.Debug("Added ICE candidate", "sessionID", s.ID)
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

// IsDummyTrack checks if a given track ID corresponds to a dummy track.
func (s *Session) IsDummyTrack(trackID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, exists := s.dummyTrackIDs[trackID]
	return exists
}
