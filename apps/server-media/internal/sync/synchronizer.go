package sync

import (
	"context"
	"log/slog"
	"time"

	"speaky-media/internal/pipeline"
)

// Synchronizer manages the egress of audio and video packets and adaptive synchronization.
// It ensures video is delayed effectively to match audio processing latency.
// It uses callbacks to output data, decoupling it from the transport layer.
type Synchronizer struct {
	estimator *LatencyEstimator
}

// NewSynchronizer creates a new Synchronizer.
func NewSynchronizer() *Synchronizer {
	return &Synchronizer{
		estimator: NewLatencyEstimator(0.1), // Alpha 0.1 for stability
	}
}

// RunAudioPump starts the audio consumer loop.
// It consumes from the audio queue, measures "Processing Latency" (Time - ArrivalTime),
// feeds the estimator, and outputs via onFrame.
// CRITICAL: frameDuration controls the Pacing. We MUST send 1 packet per frameDuration
// to avoid network bursts when AI returns large chunks (e.g. 5s) instantly.
func (s *Synchronizer) RunAudioPump(ctx context.Context, queue *pipeline.Queue[pipeline.RTPPacket], frameDuration time.Duration, onFrame func([]byte)) {
	slog.Info("Sync: AudioPump Started", "pacingMs", frameDuration.Milliseconds())
	go func() {

		var lastSendTime time.Time
		
		for {
			packet, err := queue.Pop(ctx)
			if err != nil {
				return // Context cancelled or queue closed
			}

			// Pacing Logic: Sleep-based Rate Limiting
			// 1. If we just sent a packet, wait until the next slot (frameDuration).
			// 2. If we were idle (queue empty) for a long time, lastSendTime is old,
			//    so time.Since > frameDuration, and we send IMMEDIATELY (no sleep).
			//    This fixes the issue where the first packet of a burst was delayed unnecessarily.
			
			elapsed := time.Since(lastSendTime)
			if elapsed < frameDuration {
				time.Sleep(frameDuration - elapsed)
			}
			
			// Update lastSendTime to NOW (after the sleep)
			// This enforces at least 'frameDuration' interval between physical sends.
			lastSendTime = time.Now()

			// Measure Latency (Simulating Audio Processing Duration)
			// In real transcoding, this loop runs AFTER transcoding/AI.
			// "Packet Arrival" was when it entered the system.
			// "Now" is when we are about to play it out.
			// Difference is total pipeline latency.
			latency := time.Since(packet.ArrivalTime)

			// Update the estimator
			s.estimator.Update(latency)

			// Output payload
			onFrame(packet.Data)
		}
	}()
}

// RunVideoPump starts the video consumer loop.
// It polls the VideoBuffer, updates its target delay from the estimator, and outputs frames.
func (s *Synchronizer) RunVideoPump(ctx context.Context, buffer *VideoBuffer, onFrame func([]byte)) {
	slog.Info("Sync: VideoPump Started")
	go func() {
		// Wait for Audio to establish latency baseline (Sync Start)
		// Fallback to immediate start if audio is missing/broken (> 5s)
		slog.Info("Sync: VideoPump Waiting for Audio Latency...")
		timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()

		_ = s.estimator.WaitReady(timeoutCtx) // Ignore error, just proceed on timeout
		slog.Info("Sync: VideoPump Resuming (Audio Ready or Timeout)")

		count := 0
		for {
			select {
			case <-ctx.Done():
				return
			default:
			}

			// 1. Update Target Delay from Audio Latency
			avgLat := s.estimator.GetAverage()

			// Safety: If audio pipeline hasn't established a latency yet,
			// avgLat will be 0 or small. VideoBuffer handles min delay naturally.
			if avgLat > 0 {
				buffer.SetDelay(avgLat)
			}

			// 2. Drain Ready Packets
			drained := 0
			for {
				packetData, ready := buffer.PopReady()
				if !ready {
					break
				}
				onFrame(packetData)
				drained++
			}

			// Warn if buffer is getting dangerously full (e.g. > 75% used)
			threshold := int(float64(buffer.Cap()) * 0.75)
			if buffer.Len() > threshold && count%100 == 0 {
				slog.Warn("Sync: Video Buffer High", "len", buffer.Len(), "cap", buffer.Cap())
			count++
			}

			// Poll interval
			time.Sleep(10 * time.Millisecond)
		}
	}()
}
