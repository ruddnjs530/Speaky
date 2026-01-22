package pipeline_test

import (
	"context"
	"testing"
	"time"

	"github.com/pion/rtp"
	"github.com/stretchr/testify/assert"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/audio"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/pipeline"
)

// TestOpusToPCMTranscoder_Pipeline verifies the full audio processing flow.
// Opus (Input) -> Decoder -> Resampler -> Buffer -> PCM 16k (Output)
func TestOpusToPCMTranscoder_Pipeline(t *testing.T) {
	// Mock Config
	cfg := &config.Config{
		AudioSampleRate: 16000,
		AudioChannels:   1,
		PCMBufferSize:   50,
	}

	track, err := pipeline.NewOpusToPCMTranscoder(cfg)
	assert.NoError(t, err)

	go func() {
		for i := range 50 {
			// Trigger PLC with empty payload, but set Timestamp
			ts := uint32(i * 960) // 960 samples per frame (20ms @ 48kHz)
			err := track.WriteOpus(&rtp.Packet{
				Header: rtp.Header{
					Timestamp: ts,
				},
			})
			assert.NoError(t, err)

			time.Sleep(10 * time.Millisecond)
		}
	}()

	for i := range 50 {
		frame, err := track.ReadPCM(context.Background())
		assert.NoError(t, err)
		assert.NotNil(t, frame)

		assert.NotEmpty(t, frame.Data, "Output PCM should not be empty")

		// Verify Timestamp Propagation
		expectedTS := uint32(i * 960)
		assert.Equal(t, expectedTS, frame.Timestamp, "Timestamp should be preserved")

		expectedSamples := cfg.AudioSampleRate * audio.PLCDurationMs / 1000
		expectedSize := expectedSamples * cfg.AudioChannels * 2

		assert.InDelta(t, expectedSize, len(frame.Data), float64(expectedSize)*0.2,
			"Output PCM size should match configured spec")
	}
}
