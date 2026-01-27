package sync

import (
	"context"
	"testing"
	"time"

	"speaky-media/internal/pipeline"
)

func TestSynchronizer_AdaptiveDelay(t *testing.T) {
	// Setup
	syncr := NewSynchronizer()

	audioQ := pipeline.NewQueue[pipeline.RTPPacket](10)
	videoBuf := NewVideoBuffer(10, 100*time.Millisecond) // Initial Delay 100ms

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	audioCh := make(chan []byte, 10)
	videoCh := make(chan []byte, 10)

	onAudio := func(p []byte) { audioCh <- p }
	onVideo := func(p []byte) { videoCh <- p }

	// Start Pumps
	syncr.RunAudioPump(ctx, audioQ, onAudio)
	syncr.RunVideoPump(ctx, videoBuf, onVideo)

	// 1. Push Audio to set Estimator
	// Latency 200ms
	start := time.Now()
	audioQ.Push(pipeline.RTPPacket{
		Data:        []byte("audio"),
		ArrivalTime: start.Add(-200 * time.Millisecond),
	})

	// Wait for audio
	select {
	case <-audioCh:
		t.Log("Audio processed")
	case <-time.After(500 * time.Millisecond):
		t.Fatal("Timeout waiting for audio")
	}

	// Verify Estimator
	avg := syncr.estimator.GetAverage()
	t.Logf("Estimator: %v", avg)
	if avg < 150*time.Millisecond {
		t.Errorf("Estimator too low: %v", avg)
	}

	// 2. Push Video
	videoBuf.Push(pipeline.RTPPacket{
		Data:        []byte("video"),
		ArrivalTime: time.Now(),
	})

	// 3. Expect delay > 150ms.
	// Wait 100ms. verify NOT arrived.
	select {
	case <-videoCh:
		t.Error("Video arrived too early (should be delayed)")
	case <-time.After(100 * time.Millisecond):
		t.Log("Video correctly delayed (100ms passed)")
	}

	// 4. Wait remaining time.
	// Delay is ~200ms. Elapsed 100ms. Need ~100ms.
	// Wait 500ms to be sure.
	select {
	case <-videoCh:
		t.Log("Video arrived correctly")
	case <-time.After(500 * time.Millisecond):
		t.Error("Timeout waiting for video (Adaptive Delay failed)")
	}
}
