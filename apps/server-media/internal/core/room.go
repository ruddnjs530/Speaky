package core

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"sync"

	"speaky-media/internal/config"

	"github.com/pion/webrtc/v4"
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
}

// NewRoom creates a new room with the given ID.
func NewRoom(id string, cfg *config.Config, api *webrtc.API) *Room {
	ctx, cancel := context.WithCancel(context.Background())

	return &Room{
		ID:           id,
		sessions:     make(map[string]*Session),
		activeTracks: make(map[string]*ActiveTrack),
		cfg:          cfg,
		api:          api,
		ctx:          ctx,
		cancel:       cancel,
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

	// 3. Start Single Reader Goroutine (CRITICAL FIX for Fan-out)
	go r.processRTP(trackCtx, activeTrack)

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

		// Fan-out: Write to ALL subscribers
		activeTrack.mu.RLock()
		for sessionID, localTrack := range activeTrack.subscribers {
			if _, err := localTrack.Write(buf[:n]); err != nil {
				// Don't log per-packet write errors (too noisy)
				// Subscriber will be removed when they leave
				_ = sessionID // Silence unused variable warning
			}
		}
		activeTrack.mu.RUnlock()
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
