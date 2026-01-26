package sync

import (
	"context"
	"sync"
	"testing"
	"time"

	"speaky-media/internal/pipeline"
)

func TestSynchronizer_Run(t *testing.T) {
	// Setup
	audioQ := pipeline.NewQueue(10, 100)
	videoDelay := 50 * time.Millisecond
	videoBuf := NewVideoBuffer(10, 100, videoDelay)

	syncr := NewSynchronizer(audioQ, videoBuf)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var mu sync.Mutex
	audioCount := 0
	videoCount := 0

	writeAudio := func(p []byte) error {
		mu.Lock()
		audioCount++
		mu.Unlock()
		return nil
	}

	writeVideo := func(p []byte) error {
		mu.Lock()
		videoCount++
		mu.Unlock()
		return nil
	}

	// Start Run in background
	done := make(chan struct{})
	go func() {
		syncr.Run(ctx, writeAudio, writeVideo)
		close(done)
	}()

	// 1. Push Audio (Immediate)
	audioQ.Push([]byte("audio1"))

	// 2. Push Video (Delayed)
	videoBuf.Push([]byte("video1"))

	// 3. Check immediately -> Audio should be 1, Video 0
	time.Sleep(10 * time.Millisecond)
	mu.Lock()
	if audioCount != 1 {
		t.Errorf("Expected audio 1, got %d", audioCount)
	}
	if videoCount != 0 {
		t.Errorf("Expected video 0, got %d", videoCount)
	}
	mu.Unlock()

	// 4. Wait for video delay
	time.Sleep(videoDelay + 30*time.Millisecond) // + buffer for ticker
	mu.Lock()
	if videoCount != 1 {
		t.Errorf("Expected video 1, got %d", videoCount)
	}
	mu.Unlock()

	// Stop
	cancel()
	<-done
}
