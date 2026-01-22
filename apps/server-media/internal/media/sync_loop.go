package media

// This file contains the processAIResponse implementation for Room

import (
	"context"
	"log/slog"
	"time"

	"github.com/pion/rtp"
)

// processAIResponse is the core sync loop that integrates all Egress components.
// It receives AI-processed audio, correlates with video, encodes, and broadcasts.
//
// Flow:
//  1. Receive AI audio response (16kHz PCM + Ingestion TS)
//  2. Initialize baseline timestamps on first packet
//  3. Calculate correlated Video TS using Delta formula
//  4. Pop video packets from VideoQueue
//  5. Encode audio to Opus (generates independent Egress TS)
//  6. Send Audio + Video to SFU Sender
func (r *Room) processAIResponse(ctx context.Context, p *Participant) {
	slog.Debug("Starting AI Response Processor", "user_id", p.ID)
	defer slog.Debug("Stopping AI Response Processor", "user_id", p.ID)

	// Create a ticker to pace the output (20ms per frame)
	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return

		case <-ticker.C:
			// Read one frame from the channel
			select {
			case <-ctx.Done():
				return
			case aiAudio, ok := <-p.AIResponseChan:
				if !ok {
					slog.Warn("AI response channel closed", "user_id", p.ID)
					return
				}

				// Step 1: Initialize baseline timestamps on first packet
				r.syncMu.Lock()
				if !r.baseInitialized {
					r.baseAudioTS = aiAudio.Timestamp
					// We'll set baseVideoTS when we first pop video
					// For now, just mark as initialized
					r.baseInitialized = true
					slog.Info("Sync baseline initialized", "baseAudioTS", r.baseAudioTS)
				}
				r.syncMu.Unlock()

				// Step 2: Calculate correlated Video TS
				r.syncMu.Lock()
				currentBaseVideoTS := r.baseVideoTS
				var targetVideoTS uint32
				if currentBaseVideoTS != 0 {
					targetVideoTS = GetCorrelatedVideoTS(aiAudio.Timestamp, r.baseAudioTS, currentBaseVideoTS)
				}
				r.syncMu.Unlock()

				// Step 3: Pop video packets from VideoQueue
				// If baseline not set, pop the FIRST available packet to establish baseline
				var videoPackets []*rtp.Packet
				if currentBaseVideoTS == 0 {
					videoPackets = p.VideoQueue.PopFirst()
				} else {
					videoPackets = p.VideoQueue.PopUntil(targetVideoTS)
				}

				// Update baseVideoTS if this is the first video packet
				if len(videoPackets) > 0 {
					r.syncMu.Lock()
					if r.baseVideoTS == 0 {
						r.baseVideoTS = videoPackets[0].Timestamp
						slog.Info("Video baseline set", "baseVideoTS", r.baseVideoTS)
					}
					r.syncMu.Unlock()
				}

				// Step 4: Encode audio (AI PCM → Opus RTP)
				rtpAudio, err := p.OpusEncoder.Encode(aiAudio)
				if err != nil {
					slog.Error("Failed to encode audio", "error", err, "user_id", p.ID)
					continue
				}

				// Step 5: Send Audio to Guest
				if err := p.SFUSender.WriteRTP(rtpAudio); err != nil {
					slog.Error("Failed to send audio RTP", "error", err, "user_id", p.ID)
				}

				// Step 6: Send Video to Guest (if available)
				for _, vp := range videoPackets {
					if err := p.SFUSender.WriteRTP(vp); err != nil {
						slog.Error("Failed to send video RTP", "error", err, "user_id", p.ID)
						break
					}
				}
			}
		}
	}
}
