package core

import (
	"context"
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
type ActiveTrack struct {
	Remote  *webrtc.TrackRemote
	OwnerID string
	Kind    webrtc.RTPCodecType
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
