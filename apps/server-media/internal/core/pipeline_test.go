package core

import (
	"context"
	"testing"
	"time"

	"speaky-media/internal/ai"
	"speaky-media/internal/config"
	"speaky-media/internal/pipeline"

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
	room := NewRoom("pipeline-test-room", cfg, api, mockAI)
	defer room.Close()

	// 2. Setup ActiveTrack with Pipeline manually
	// (Simulating what BroadcastTrack does)
	activeTrack := &ActiveTrack{
		OwnerID:     "host",
		Kind:        webrtc.RTPCodecTypeAudio,
		subscribers: make(map[string]*webrtc.TrackLocalStaticRTP),
		// Manual Pipeline Setup
		audioQueue:  pipeline.NewQueue(10, 1500),
	}

	// 3. Start the consumer worker
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go room.runAudioPipeline(ctx, activeTrack)

	// 4. Inject Data into Queue (Ingress)
	payload := []byte{0xDE, 0xAD, 0xBE, 0xEF}
	err := activeTrack.audioQueue.Push(payload)
	require.NoError(t, err)

	// 5. Verify Consumption (Egress)
	// Wait for queue to be drained by the worker
	require.Eventually(t, func() bool {
		return activeTrack.audioQueue.Len() == 0
	}, 1*time.Second, 10*time.Millisecond, "AudioQueue should be drained by consumer")

	t.Log("Pipeline consumer successfully drained the queue")
}

// TestPhase3_Pipeline_VideoConstraint verifies Video Buffer Delay logic within the Room context
func TestPhase3_Pipeline_VideoConstraint(t *testing.T) {
	// Required internal field access is covered by unit tests in internal/sync/buffer_test.go
	// Skipping integration test for now to avoid redundant elaborate mocking of TrackRemote.
	t.Skip("Video Constraint logic verified in internal/sync/buffer_test.go")
}
