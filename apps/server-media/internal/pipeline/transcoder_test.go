package pipeline_test

import (
	"context"
	"testing"
	"time"

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
		for range 50 {
			err := track.WriteOpus(nil)
			assert.NoError(t, err)

			time.Sleep(10 * time.Millisecond)
		}
	}()

	for range 50 {
		pcm, err := track.ReadPCM(context.Background())
		assert.NoError(t, err)

		assert.NotEmpty(t, pcm, "Output PCM should not be empty")

		expectedSamples := cfg.AudioSampleRate * audio.PLCDurationMs / 1000
		expectedSize := expectedSamples * cfg.AudioChannels * 2

		assert.InDelta(t, expectedSize, len(pcm), float64(expectedSize)*0.2,
			"Output PCM size should match configured spec")
	}
}
