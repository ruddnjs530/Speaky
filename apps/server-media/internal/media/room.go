package media

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"github.com/pion/rtp"
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

	// Sync baseline timestamps (for Delta-based correlation)
	baseAudioTS     uint32
	baseVideoTS     uint32
	baseInitialized bool
	syncMu          sync.Mutex

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

	// D. Opus Encoder (for Egress: AI PCM → Opus RTP)
	opusEncoder, err := pipeline.NewOpusEncoder(r.cfg.AudioSampleRate, r.cfg.AudioChannels, 0)
	if err != nil {
		pCancel()
		receiver.Close()
		sender.Close()
		return "", fmt.Errorf("failed to create opus encoder: %w", err)
	}

	// E. SFU Sender (for broadcasting to Guest)
	// Create a new PeerConnection for Egress
	egressPC, err := r.api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		pCancel()
		receiver.Close()
		sender.Close()
		opusEncoder.Close()
		return "", fmt.Errorf("failed to create egress peer connection: %w", err)
	}

	sfuSender, err := mediaWebrtc.NewPionSender(egressPC)
	if err != nil {
		pCancel()
		receiver.Close()
		sender.Close()
		opusEncoder.Close()
		egressPC.Close()
		return "", fmt.Errorf("failed to create SFU sender: %w", err)
	}

	// 4. Assemble Participant
	participant := &Participant{
		ID:             userID,
		Receiver:       receiver,
		Transcoder:     transcoder,
		Sender:         sender,
		VideoQueue:     pipeline.NewVideoQueue(),
		OpusEncoder:    opusEncoder,
		SFUSender:      sfuSender,
		AIResponseChan: make(chan *pipeline.AudioFrame, 50), // Buffered channel
		CancelFunc:     pCancel,
	}

	// 5. Connect Pipeline (Handler Registration)
	// CRITICAL: Must register handlers BEFORE calling Connect to avoid dropping initial packets.
	r.wirePipeline(pCtx, participant)

	// 6. Start AI Response Processing Loop
	go r.processAIResponse(pCtx, participant)

	// 7. Perform SDP Exchange (Connect)
	// This will block until ICE gathering is complete (unless Trickle ICE logic is added later).
	sdpAnswer, err := receiver.Connect(sdpOffer)
	if err != nil {
		pCancel()
		receiver.Close()
		sender.Close()
		opusEncoder.Close()
		sfuSender.Close()
		return "", fmt.Errorf("failed to connect receiver: %w", err)
	}

	// 7. Register Participant
	// Check if user already exists (Re-join Logic)
	// Note: Ideally we check this earlier, but checking here holding lock is also fine.
	// If we want to prevent double-init, check at step 0. Assuming simple replacement here.
	if oldP, exists := r.participants[userID]; exists {
		slog.Warn("User re-joining, closing old session", "room_id", r.ID, "user_id", userID)
		// Explicitly Close resources first
		oldP.Close()
		// Remove from map to minimize race condition window
		delete(r.participants, userID)
	}

	r.participants[userID] = participant

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

// wirePipeline connects the Receiver, Transcoder, and Sender.
// This logic is extracted for testability (unexported to allow white-box testing).
func (r *Room) wirePipeline(ctx context.Context, p *Participant) {
	// A. Wire Audio
	p.Receiver.OnAudioPacket(func(packet *rtp.Packet) {
		// INGESTION: Audio RTP Packet -> Transcoder
		// Day 3.5 Refactoring: Transcoder now accepts *rtp.Packet directly.
		if err := p.Transcoder.WriteOpus(packet); err != nil {
			slog.Warn("Failed to write opus", "err", err, "user_id", p.ID)
		}
	})

	// B. Wire Video (Buffer for Sync)
	p.Receiver.OnVideoPacket(func(packet *rtp.Packet) {
		p.VideoQueue.Push(packet)
	})

	// C. Start Audio Pump (Transcoder -> Sender)
	go r.pumpAudio(ctx, p)
}

// pumpAudio continuously reads PCM from Transcoder, sends to AI, and forwards responses.
// Unexported for white-box testing.
func (r *Room) pumpAudio(ctx context.Context, p *Participant) {
	slog.Debug("Starting Audio Pump", "user_id", p.ID)
	defer slog.Debug("Stopping Audio Pump", "user_id", p.ID)

	// Start a goroutine to receive AI responses
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			default:
			}

			// Receive AI response from stream
			aiResponse, err := p.Sender.Receive()
			if err != nil {
				if ctx.Err() != nil {
					return // Context cancelled
				}
				slog.Error("Failed to receive AI response", "error", err, "user_id", p.ID)
				return
			}

			// Forward to AI response channel for processing
			select {
			case p.AIResponseChan <- aiResponse:
			case <-ctx.Done():
				return
			}
		}
	}()

	consecutiveErrors := 0
	const maxConsecutiveErrors = 100

	for {
		// 1. Check Cancellation
		select {
		case <-ctx.Done():
			return
		default:
		}

		// 2. Read PCM (Blocking with Context)
		frame, err := p.Transcoder.ReadPCM(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return // Context cancelled
			}
			slog.Error("Transcoder ReadPCM error", "err", err, "user_id", p.ID)
			// Decide: Continue or Break? Break prevents tight loop on error.
			return
		}

		// 3. Send to Upstream (AI Server)
		if err := p.Sender.Send(frame); err != nil {
			consecutiveErrors++
			if consecutiveErrors <= 5 { // Throttle logs
				slog.Error("Upstream Send error", "err", err, "user_id", p.ID)
			}
			if consecutiveErrors >= maxConsecutiveErrors {
				slog.Error("Upstream Send failed too many times, Aborting Pump", "user_id", p.ID)
				return // Circuit Breaker
			}
		} else {
			consecutiveErrors = 0 // Reset on success
		}
	}
}
