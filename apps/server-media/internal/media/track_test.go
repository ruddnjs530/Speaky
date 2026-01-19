package media_test

import (
	"testing"
	"time"

	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/audio"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/media"
	"github.com/stretchr/testify/assert"
)

// TestRegularTrack_Pipeline verifies the full audio processing flow.
// Opus (Input) -> Decoder -> Resampler -> Buffer -> PCM 16k (Output)
func TestRegularTrack_Pipeline(t *testing.T) {
	track, err := media.NewRegularTrack()
	assert.NoError(t, err)

	go func() {
		for range 50 {
			err := track.WriteOpus(nil)
			assert.NoError(t, err)

			time.Sleep(10 * time.Millisecond)
		}
	}()

	for range 50 {
		pcm, err := track.ReadPCM()
		assert.NoError(t, err)

		assert.NotEmpty(t, pcm, "Output PCM should not be empty")

		expectedSamples := audio.TargetSampleRate * audio.PLCDurationMs / 1000
		expectedSize := expectedSamples * audio.DefaultChannels * 2

		assert.InDelta(t, expectedSize, len(pcm), float64(expectedSize)*0.2,
			"Output PCM size should match 16kHz spec")
	}
}
