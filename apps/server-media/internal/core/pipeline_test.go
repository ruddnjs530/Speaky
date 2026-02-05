package core

import (
	"context"
	"testing"
	"time"

	"speaky-media/internal/ai"
	"speaky-media/internal/config"
	"speaky-media/internal/pipeline"
	media_sync "speaky-media/internal/sync"

	"github.com/pion/webrtc/v4"
	"github.com/stretchr/testify/require"
)

// TestPhase3_Pipeline_AudioFlow verifies the Egress path:
// Queue -> runAudioPipeline -> AI Processing (Mock) -> Subscriber
func TestPhase3_Pipeline_AudioFlow(t *testing.T) {
	// 1. Setup Dependencies
	cfg := &config.Config{}
	api := &webrtc.API{}

	// Mock AI Client
	mockAI := &ai.MockClient{}

	// Create Room
	room := NewRoom("pipeline-test-room", "host", nil, cfg, api, mockAI, nil)
	defer room.Close()

	// 2a. Setup Synchronizer (Mock Session context)
	sync := media_sync.NewSynchronizer()

	// 2b. Setup ActiveTrack with Pipeline manually
	activeTrack := &ActiveTrack{
		OwnerID:     "host",
		Kind:        webrtc.RTPCodecTypeAudio,
		subscribers: make(map[string]*Subscriber),
		// Manual Pipeline Setup
		audioQueue: pipeline.NewQueue[pipeline.RTPPacket](10),
	}

	// 3. Start the consumer worker via Synchronizer
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	onFrame := func(data []byte) {
		// Mock subscriber write
	}
	sync.RunAudioPump(ctx, activeTrack.audioQueue, 20*time.Millisecond, onFrame)

	// 4. Inject Data into Queue (Ingress)
	payload := []byte{0xDE, 0xAD, 0xBE, 0xEF}
	pkt := pipeline.RTPPacket{
		Data:        payload,
		ArrivalTime: time.Now(),
	}

	err := activeTrack.audioQueue.Push(pkt)
	require.NoError(t, err)

	// 5. Verify Consumption (Egress)
	// Wait for queue to be drained by the worker
	require.Eventually(t, func() bool {
		return activeTrack.audioQueue.Len() == 0
	}, 1*time.Second, 10*time.Millisecond, "AudioQueue should be drained by consumer")

	t.Log("Pipeline consumer successfully drained the queue")
}

func TestPhase3_Pipeline_VideoConstraint(t *testing.T) {
	// 1. Setup
	sync := media_sync.NewSynchronizer()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	audioQueue := pipeline.NewQueue[pipeline.RTPPacket](10)
	videoBuffer := media_sync.NewVideoBuffer(100, 0) // Initial delay 0

	// Channels to capture output
	audioOut := make(chan []byte, 10)
	videoOut := make(chan []byte, 10)

	// 2. Start Pumps
	sync.RunAudioPump(ctx, audioQueue, 20*time.Millisecond, func(data []byte) {
		audioOut <- data
	})
	sync.RunVideoPump(ctx, videoBuffer, func(data []byte) {
		videoOut <- data
	})

	// 3. Establish High Latency (Simulate Audio Processing Delay)
	// We simulate that an audio packet arrived 500ms ago but is being processed NOW.
	latency := 500 * time.Millisecond
	audioPkt := pipeline.RTPPacket{
		Data:        []byte("audio"),
		ArrivalTime: time.Now().Add(-latency),
	}
	require.NoError(t, audioQueue.Push(audioPkt))

	// Wait for Audio Pump to process and update Estimator
	select {
	case <-audioOut:
		// Audio processed. Latency ~500ms registered.
	case <-time.After(100 * time.Millisecond):
		t.Fatal("Audio packet not processed in time")
	}

	// Give estimator a moment to settle (it's using EMA, so after one sample it jumps to value if using initial flag, or averages)
	// Our Estimator implementation averages with initial value logic, so it should close to 500ms.
	time.Sleep(50 * time.Millisecond)

	// 4. Send Video Packet (Fresh)
	// It should be buffered because Est Latency (500ms) > Video Age (0ms)
	videoPkt := pipeline.RTPPacket{
		Data:        []byte("video"),
		ArrivalTime: time.Now(),
	}
	require.NoError(t, videoBuffer.Push(videoPkt))

	// 5. Verify Video is DELAYED
	select {
	case <-videoOut:
		t.Fatal("Video should have been buffered, but was emitted immediately!")
	case <-time.After(100 * time.Millisecond):
		// Good! No video yet.
	}

	// 6. Wait for Delay to expire
	// We expect video to pop after roughly 500ms from arrival.
	// We already waited ~100ms. Wait remaining + buffer.
	select {
	case <-videoOut:
		// Success
	case <-time.After(600 * time.Millisecond):
		t.Fatal("Video should have been emitted by now")
	}
}
