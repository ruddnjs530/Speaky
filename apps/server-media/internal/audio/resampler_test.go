package audio_test

import (
	"testing"

	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/audio"
	"github.com/stretchr/testify/assert"
)

func TestResampler_Ratio(t *testing.T) {
	resampler, err := audio.NewResampler()
	assert.NoError(t, err)

	inputSamples := audio.DefaultSampleRate * audio.PLCDurationMs / 1000
	inputSize := inputSamples * audio.DefaultChannels * 2

	inputData := make([]byte, inputSize)

	outputData, err := resampler.Resample(inputData)

	assert.NoError(t, err)

	expectedSamples := audio.TargetSampleRate * audio.PLCDurationMs / 1000
	expectedSize := expectedSamples * audio.DefaultChannels * 2

	// 리샘플링 필터의 'Group Delay'로 인해 초반 몇 샘플이 버퍼링되어 덜 나올 수 있습니다.
	tolerance := float64(expectedSize) * 0.1

	assert.InDelta(t, expectedSize, len(outputData), tolerance,
		"Resampling output size mismatch (within tolerance). Input: %dHz, Target: %dHz",
		audio.DefaultSampleRate, audio.TargetSampleRate)

	assert.NotEmpty(t, outputData)
}
