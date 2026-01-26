package sync

import (
	"context"
	"sync"
	"time"

	"speaky-media/internal/pipeline"
)

// Synchronizer manages the egress of audio and video packets.
// It ensures video is delayed effectively to match audio processing latency.
type Synchronizer struct {
	audioQueue   *pipeline.Queue
	videoBuffer  *VideoBuffer
}

// NewSynchronizer creates a new Synchronizer.
func NewSynchronizer(audioQ *pipeline.Queue, videoQ *VideoBuffer) *Synchronizer {
	return &Synchronizer{
		audioQueue:  audioQ,
		videoBuffer: videoQ,
	}
}

// Run starts the egress loops.
// writeAudio: callback to send audio RTP
// writeVideo: callback to send video RTP
// It blocks until context is cancelled code.
func (s *Synchronizer) Run(ctx context.Context, writeAudio func([]byte) error, writeVideo func([]byte) error) error {
	var wg sync.WaitGroup
	wg.Add(2)

	// 1. Audio Egress Loop
	go func() {
		defer wg.Done()
		for {
			// Blocking pop
			packet, err := s.audioQueue.Pop(ctx)
			if err != nil {
				return // Context cancelled or queue closed
			}

			if err := writeAudio(packet); err != nil {
				// Log error?
				continue
			}
		}
	}()

	// 2. Video Egress Loop
	go func() {
		defer wg.Done()
		ticker := time.NewTicker(10 * time.Millisecond) // Poll interval
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				// Drain all ready packets
				for {
					packet, ready := s.videoBuffer.PopReady()
					if !ready {
						break
					}

					if err := writeVideo(packet); err != nil {
						continue
					}
				}
			}
		}
	}()

	// Wait for both to finish (which happens on ctx cancel)
	wg.Wait()
	return nil
}
