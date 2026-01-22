package media

// This file contains the processAIResponse implementation for Room

import (
	"context"
	"log/slog"
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

	for {
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
			targetVideoTS := GetCorrelatedVideoTS(aiAudio.Timestamp, r.baseAudioTS, r.baseVideoTS)
			r.syncMu.Unlock()

			// Step 3: Pop video packets from VideoQueue
			videoPackets := p.VideoQueue.Pop(targetVideoTS)

			// Update baseVideoTS if this is the first video packet
			if videoPackets != nil && len(videoPackets) > 0 {
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
				// Continue even if send fails
			}

			// Step 6: Send Video to Guest (if available)
			if videoPackets != nil {
				for _, vp := range videoPackets {
					if err := p.SFUSender.WriteRTP(vp); err != nil {
						slog.Error("Failed to send video RTP", "error", err, "user_id", p.ID)
						break
					}
				}
			} else {
				slog.Warn("No video packets for sync", 
					"audioTS", aiAudio.Timestamp, 
					"targetVideoTS", targetVideoTS,
					"user_id", p.ID)
			}
		}
	}
}
