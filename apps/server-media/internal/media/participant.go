package media

import (
	"context"

	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/pipeline"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/upstream"
	mediaWebrtc "lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/webrtc"
)

// Participant represents a connected user in a room.
// It bundles all resources associated with a single WebRTC session.
type Participant struct {
	ID string

	// Ingestion (Host → Server)
	Receiver   mediaWebrtc.Receiver
	Transcoder pipeline.Transcoder
	VideoQueue *pipeline.VideoQueue

	// AI Processing
	Sender         upstream.AudioSender // Sends to AI
	AIResponseChan chan *pipeline.AudioFrame

	// Egress (Server → Guest)
	OpusEncoder *pipeline.OpusEncoder
	SFUSender   mediaWebrtc.Sender

	// Lifecycle Management
	// CancelFunc shuts down all goroutines (Pump, Receiver Loop) for this participant.
	CancelFunc context.CancelFunc
}

// Close releases all resources associated with the participant.
func (p *Participant) Close() {
	if p.CancelFunc != nil {
		p.CancelFunc()
	}
	if p.Receiver != nil {
		if err := p.Receiver.Close(); err != nil {
			// Log error but continue cleanup
		}
	}
	if p.Sender != nil {
		if err := p.Sender.Close(); err != nil {
			// Log error
		}
	}
	if p.OpusEncoder != nil {
		if err := p.OpusEncoder.Close(); err != nil {
			// Log error
		}
	}
	if p.SFUSender != nil {
		if err := p.SFUSender.Close(); err != nil {
			// Log error
		}
	}
	if p.AIResponseChan != nil {
		close(p.AIResponseChan)
	}
	// Transcoder channels are cleaned up by GC when writers stop
}
