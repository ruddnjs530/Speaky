package core

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"sync"
	"time"

	"speaky-media/internal/config"

	"github.com/pion/webrtc/v4"

	"speaky-media/internal/ai"
	"speaky-media/internal/pipeline"
	media_sync "speaky-media/internal/sync"
)

// Room represents a media routing room (SFU).
// It manages participant sessions and broadcasts tracks.
type Room struct {
	ID           string
	sessions     map[string]*Session
	activeTracks map[string]*ActiveTrack // Key is Track ID (not UserID), Value is the track info
	mu           sync.RWMutex
	cfg          *config.Config
	api          *webrtc.API
	ctx          context.Context
	cancel       context.CancelFunc
	aiClient     ai.Client
}

// ActiveTrack stores information about a track currently being broadcast in the room.
// It manages the list of subscribers for Fan-out distribution.
type ActiveTrack struct {
	Remote      *webrtc.TrackRemote
	OwnerID     string
	Kind        webrtc.RTPCodecType
	subscribers map[string]*webrtc.TrackLocalStaticRTP // Key: sessionID, Value: local track
	mu          sync.RWMutex                            // Protects subscribers map
	cancel      context.CancelFunc                      // To stop processRTP goroutine

	// Pipeline components
	audioQueue  *pipeline.Queue[pipeline.RTPPacket]
	videoBuffer *media_sync.VideoBuffer
}

// NewRoom creates a new room with the given ID.
func NewRoom(id string, cfg *config.Config, api *webrtc.API, aiClient ai.Client) *Room {
	ctx, cancel := context.WithCancel(context.Background())

	return &Room{
		ID:           id,
		sessions:     make(map[string]*Session),
		activeTracks: make(map[string]*ActiveTrack),
		cfg:          cfg,
		api:          api,
		ctx:          ctx,
		cancel:       cancel,
		aiClient:     aiClient,
	}
}

// BroadcastTrack forwards a track from one participant to all others.
// CRITICAL: This is called from OnTrack callback (Pion's internal goroutine).
// Must not block for extended periods.
func (r *Room) BroadcastTrack(fromUserID string, track *webrtc.TrackRemote, ctx context.Context) error {
	// Create child context for this specific track
	trackCtx, cancel := context.WithCancel(ctx)

	r.mu.Lock()

	// 1. Create ActiveTrack with subscriber management
	trackID := fmt.Sprintf("%s-%s", fromUserID, track.ID())
	activeTrack := &ActiveTrack{
		Remote:      track,
		OwnerID:     fromUserID,
		Kind:        track.Kind(),
		subscribers: make(map[string]*webrtc.TrackLocalStaticRTP),
		cancel:      cancel,
	}
	r.activeTracks[trackID] = activeTrack

	// 2. Add existing participants as subscribers
	for userID, session := range r.sessions {
		if userID == fromUserID {
			continue // Don't send track back to sender
		}

		if err := r.subscribeToTrack(session, activeTrack); err != nil {
			slog.Warn("Failed to subscribe session to track",
				"sessionID", userID,
				"trackID", trackID,
				"error", err,
			)
			// Continue with other sessions (non-fatal)
		}
	}

	r.mu.Unlock()

	// 3. Initialize Pipeline Components
	// 3. Initialize Pipeline Components
	// Note: We use 100 packet buffer. 20ms audio * 100 = 2s buffer. Video depends on FPS.
	session := r.sessions[fromUserID]

	// Define Fan-Out Callback (Sending to all subscribers)
	onFrame := func(data []byte) {
		activeTrack.mu.RLock()
		for _, localTrack := range activeTrack.subscribers {
			if _, err := localTrack.Write(data); err != nil {
				// Ignore write errors (non-fatal for one subscriber)
			}
		}
		activeTrack.mu.RUnlock()
	}

	if activeTrack.Kind == webrtc.RTPCodecTypeAudio {
		activeTrack.audioQueue = pipeline.NewQueue[pipeline.RTPPacket](100)

		// Start Audio Pump (Async)
		if session != nil {
			session.Synchronizer.RunAudioPump(trackCtx, activeTrack.audioQueue, onFrame)
		} else {
			slog.Warn("Session not found for track owner, pipeline disabled", "userID", fromUserID)
		}

	} else if activeTrack.Kind == webrtc.RTPCodecTypeVideo {
		// Video Buffer with 600ms default delay (Adaptive will adjust)
		activeTrack.videoBuffer = media_sync.NewVideoBuffer(200, 600*time.Millisecond)

		// Start Video Pump (Async)
		if session != nil {
			session.Synchronizer.RunVideoPump(trackCtx, activeTrack.videoBuffer, onFrame)
		} else {
			slog.Warn("Session not found for track owner, pipeline disabled", "userID", fromUserID)
		}
	}

	// 4. Start Ingress Goroutine (Reads from Remote -> Pushes to Pipeline)
	go r.processRTP(trackCtx, activeTrack)

	return nil
}




// Join adds a new participant to the room and establishes WebRTC connection.
// Supports Late Joiner scenario by subscribing to all existing tracks.
func (r *Room) Join(userID, offerSDP string) (string, error) {
	r.mu.Lock()

	// 1. Check if user already exists
	if _, exists := r.sessions[userID]; exists {
		r.mu.Unlock()
		return "", fmt.Errorf("%w: %s", ErrSessionAlreadyExists, userID)
	}

	// 2. Create PeerConnection using room's WebRTC API
	pc, err := r.api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		r.mu.Unlock()
		return "", fmt.Errorf("failed to create peer connection: %w", err)
	}

	// 3. Create Session wrapper
	session := NewSession(userID, r, pc)

	// 4. Subscribe to existing tracks (Late Joiner support)
	for _, activeTrack := range r.activeTracks {
		if activeTrack.OwnerID == userID {
			continue // Don't send user's own tracks back
		}

		if err := r.subscribeToTrack(session, activeTrack); err != nil {
			slog.Warn("Failed to subscribe to existing track",
				"sessionID", userID,
				"ownerID", activeTrack.OwnerID,
				"error", err,
			)
			// Continue with other tracks (non-fatal)
		}
	}

	// 5. Store session
	r.sessions[userID] = session
	r.mu.Unlock()

	// 6. Handle SDP offer (outside lock to avoid blocking)
	answerSDP, err := session.HandleOffer(offerSDP)
	if err != nil {
		// Cleanup on failure
		r.Leave(userID)
		return "", fmt.Errorf("failed to handle offer: %w", err)
	}

	slog.Info("User joined room",
		"roomID", r.ID,
		"userID", userID,
		"existingTracks", len(r.activeTracks),
	)

	return answerSDP, nil
}

// Leave removes a participant from the room and cleans up resources.
func (r *Room) Leave(userID string) error {
	r.mu.Lock()

	session, exists := r.sessions[userID]
	if !exists {
		r.mu.Unlock()
		return fmt.Errorf("%w: %s", ErrSessionNotFound, userID)
	}

	// Remove from sessions map
	delete(r.sessions, userID)

	// Remove this user from all track subscribers and clean up owned tracks
	for trackID, activeTrack := range r.activeTracks {
		// Remove as subscriber
		activeTrack.mu.Lock()
		delete(activeTrack.subscribers, userID)
		activeTrack.mu.Unlock()

		// If this user owns the track, stop processRTP and remove track
		if activeTrack.OwnerID == userID {
			activeTrack.cancel() // Stop processRTP goroutine
			delete(r.activeTracks, trackID)
		}
	}

	// Capture remaining sessions count before unlock
	remainingSessions := len(r.sessions)

	r.mu.Unlock()

	// Close session (outside lock to avoid blocking)
	if err := session.Close(); err != nil {
		slog.Warn("Error closing session", "userID", userID, "error", err)
	}

	slog.Info("User left room",
		"roomID", r.ID,
		"userID", userID,
		"remainingSessions", remainingSessions,
	)

	return nil
}

// subscribeToTrack adds a session as a subscriber to an active track.
// This is used by both Join (late joiner) and BroadcastTrack (new track).
func (r *Room) subscribeToTrack(session *Session, activeTrack *ActiveTrack) error {
	// Create local track for this subscriber
	localTrack, err := webrtc.NewTrackLocalStaticRTP(
		activeTrack.Remote.Codec().RTPCodecCapability,
		activeTrack.Remote.ID(),
		activeTrack.Remote.StreamID(),
	)
	if err != nil {
		return fmt.Errorf("failed to create local track: %w", err)
	}

	// Add track to subscriber's PeerConnection
	if _, err := session.pc.AddTrack(localTrack); err != nil {
		return fmt.Errorf("failed to add track to peer connection: %w", err)
	}

	// Register subscriber in ActiveTrack
	activeTrack.mu.Lock()
	activeTrack.subscribers[session.ID] = localTrack
	activeTrack.mu.Unlock()

	// Store in session for cleanup
	trackID := fmt.Sprintf("%s-%s", activeTrack.OwnerID, activeTrack.Remote.ID())
	session.AddLocalTrack(trackID, localTrack)

	return nil
}

// processRTP is the Single Reader goroutine that fans out RTP packets to all subscribers.
// CRITICAL: Only ONE processRTP runs per track (not per subscriber) to avoid packet fragmentation.
func (r *Room) processRTP(ctx context.Context, activeTrack *ActiveTrack) {
	buf := make([]byte, 1500) // MTU size for RTP packets
	errCount := 0

	for {
		select {
		case <-ctx.Done():
			return // Track owner left, stop reading
		default:
		}

		// Read ONE packet from source track
		n, _, err := activeTrack.Remote.Read(buf)
		if err != nil {
			if err == io.EOF {
				return // Track ended normally
			}
			// Avoid log explosion: only log every 100th error
			errCount++
			if errCount%100 == 1 {
				slog.Error("Track read error", "error", err, "count", errCount)
			}
			return
		}

		errCount = 0 // Reset on successful read

		// Pipeline Ingress: Push to Queue/Buffer
		// The workers (runAudioPipeline/runVideoPipeline) handle the Fan-Out.
		packetData := buf[:n] // Slice it now

		// Copy data because internal buffer is reused?
		// Pion Read(buf) fills buf.
		// If we push slice, we must copy because buf is overwritten next loop.
		payload := make([]byte, n)
		copy(payload, packetData)

		// Create Metadata Packet
		pkt := pipeline.RTPPacket{
			Data:        payload,
			ArrivalTime: time.Now(),
		}

		if activeTrack.Kind == webrtc.RTPCodecTypeAudio && activeTrack.audioQueue != nil {
			if err := activeTrack.audioQueue.Push(pkt); err != nil {
				slog.Warn("Audio queue push failed", "error", err)
			}
		} else if activeTrack.Kind == webrtc.RTPCodecTypeVideo && activeTrack.videoBuffer != nil {
			// VideoBuffer now takes RTPPacket
			if err := activeTrack.videoBuffer.Push(pkt); err != nil {
				// VideoBuffer logs its own overflow warning
			}
		} else {
			// Fallback: Direct Fan-out if no pipeline (safety)
			activeTrack.mu.RLock()
			for _, localTrack := range activeTrack.subscribers {
				localTrack.Write(payload)
			}
			activeTrack.mu.RUnlock()
		}
	}
}

// Close gracefully shuts down the room and cleans up resources.
func (r *Room) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Signal all child goroutines to stop
	r.cancel()

	// TODO: Close individual sessions when Session.Close() is implemented
	for _, session := range r.sessions {
		_ = session // Placeholder for future session.Close()
	}

	return nil
}

// TODO: Implement remaining Room methods (will be added in next step)
