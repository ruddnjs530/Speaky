package media

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/pion/webrtc/v4"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/pipeline"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/upstream"
	mediaWebrtc "lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/webrtc"
)

// Room represents a conference session hosting multiple participants.
type Room struct {
	ID string

	// Dependencies
	cfg *config.Config
	api *webrtc.API

	// Participants registry: map[user_id] -> Participant
	participants map[string]*Participant
	mu           sync.RWMutex

	// Context for the entire room
	ctx        context.Context
	cancelFunc context.CancelFunc
}

// Context returns the room's context.
// Exposed primarily for testing resource cleanup.
func (r *Room) Context() context.Context {
	return r.ctx
}

// NewRoom creates a new Room with an isolated context.
func NewRoom(id string, cfg *config.Config, api *webrtc.API) *Room {
	ctx, cancel := context.WithCancel(context.Background())
	return &Room{
		ID:           id,
		cfg:          cfg,
		api:          api,
		participants: make(map[string]*Participant),
		ctx:          ctx,
		cancelFunc:   cancel,
	}
}

// Close cleans up the room's resources.
func (r *Room) Close() {
	r.cancelFunc() // Cancels all child contexts (Participants)
	// Additional cleanup if needed (e.g., specific logging)
}

// Join handles the logic for a user joining the room.
// It assembles the media pipeline (Receiver -> Transcoder -> Sender) and performs SDP exchange.
func (r *Room) Join(userID string, sdpOffer string) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// 1. Create a Child Context for this Participant
	// If the room closes (r.ctx.Done), this context will also be cancelled.
	pCtx, pCancel := context.WithCancel(r.ctx)

	// 2. Initialize Components

	// A. WebRTC Receiver
	receiver := mediaWebrtc.NewReceiver(r.api, r.cfg)

	// B. Audio Transcoder (Opus -> PCM)
	transcoder, err := pipeline.NewOpusToPCMTranscoder(r.cfg)
	if err != nil {
		pCancel()
		receiver.Close()
		return "", fmt.Errorf("failed to create transcoder: %w", err)
	}

	// C. Upstream Sender (to AI Server)
	// Note: Creating a new connection per user for MVP.
	sender, err := upstream.NewGRPCSender(pCtx, r.cfg)
	if err != nil {
		pCancel()
		receiver.Close()
		// transcoder doesn't need explicit close, it's garbage collected if unused
		return "", fmt.Errorf("failed to create upstream sender: %w", err)
	}

	// 3. Assemble Participant
	participant := &Participant{
		ID:         userID,
		Receiver:   receiver,
		Transcoder: transcoder,
		Sender:     sender,
		CancelFunc: pCancel,
	}

	// 4. Perform SDP Exchange (Connect)
	// This will block until ICE gathering is complete (unless Trickle ICE logic is added later).
	sdpAnswer, err := receiver.Connect(sdpOffer)
	if err != nil {
		pCancel()
		receiver.Close()
		sender.Close()
		return "", fmt.Errorf("failed to connect receiver: %w", err)
	}

	// 5. Register Participant
	// Check if user already exists (Re-join Logic)
	if oldP, exists := r.participants[userID]; exists {
		slog.Warn("User re-joining, closing old session", "room_id", r.ID, "user_id", userID)
		// Explicitly Close resources first
		oldP.Close()
		// Remove from map to minimize race condition window
		delete(r.participants, userID)
	}

	r.participants[userID] = participant

	// TODO: Connect Pipeline (Day 3 Task)
	// We need to wire the Receiver's output to the Transcoder, and Transcoder's output to the Sender.
	// Example:
	// receiver.OnAudioPacket(func(data []byte) {
	//     transcoder.WriteOpus(data)
	// })
	// go func() {
	//     for {
	//         pcm, _ := transcoder.ReadPCM(pCtx)
	//         sender.Send(pcm)
	//     }
	// }()

	slog.Info("Participant Joined",
		"room_id", r.ID,
		"user_id", userID,
		"components", "Receiver+Transcoder+Sender",
	)

	return sdpAnswer, nil
}

// AddICECandidate delegates the candidate addition to the participant's receiver.
func (r *Room) AddICECandidate(userID string, candidate webrtc.ICECandidateInit) error {
	r.mu.RLock()
	defer r.mu.RUnlock()

	participant, exists := r.participants[userID]
	if !exists {
		return fmt.Errorf("participant not found: %s", userID)
	}

	// Delegate to Receiver
	return participant.Receiver.AddICECandidate(candidate)
}

// Leave handles the user leaving the room.
func (r *Room) Leave(userID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	participant, exists := r.participants[userID]
	if !exists {
		return fmt.Errorf("participant not found: %s", userID)
	}

	// Cleanup resources
	participant.Close()
	delete(r.participants, userID)

	slog.Info("Participant Left", "room_id", r.ID, "user_id", userID)
	return nil
}
