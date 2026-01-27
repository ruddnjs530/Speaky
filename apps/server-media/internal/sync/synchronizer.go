package sync

import (
	"context"
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
func (s *Synchronizer) RunAudioPump(ctx context.Context, queue *pipeline.Queue[pipeline.RTPPacket], onFrame func([]byte)) {
	go func() {
		for {
			packet, err := queue.Pop(ctx)
			if err != nil {
				return // Context cancelled or queue closed
			}

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
	go func() {
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
			for {
				packetData, ready := buffer.PopReady()
				if !ready {
					break
				}
				onFrame(packetData)
			}

			// Poll interval
			time.Sleep(10 * time.Millisecond)
		}
	}()
}
