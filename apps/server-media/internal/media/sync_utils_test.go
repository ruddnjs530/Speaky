package media

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetCorrelatedVideoTS_SameBaseline(t *testing.T) {
	// Scenario: Both streams start at 0
	baseAudioTS := uint32(0)
	baseVideoTS := uint32(0)

	// Audio progresses by 960 samples (20ms at 48kHz)
	audioTS := uint32(960)

	// Expected: Video should progress by 1800 samples (20ms at 90kHz)
	// 960 * 1.875 = 1800
	expected := uint32(1800)

	result := GetCorrelatedVideoTS(audioTS, baseAudioTS, baseVideoTS)
	assert.Equal(t, expected, result)
}

func TestGetCorrelatedVideoTS_RandomOffset(t *testing.T) {
	// Scenario: Streams start at different random offsets (realistic)
	baseAudioTS := uint32(123456)
	baseVideoTS := uint32(987654)

	// Audio progresses by 48000 samples (1 second)
	audioTS := baseAudioTS + 48000

	// Expected: Video should progress by 90000 samples (1 second)
	// Delta = 48000, VideoDelta = 48000 * 1.875 = 90000
	expected := baseVideoTS + 90000

	result := GetCorrelatedVideoTS(audioTS, baseAudioTS, baseVideoTS)
	assert.Equal(t, expected, result)
}

func TestGetCorrelatedVideoTS_MultipleFrames(t *testing.T) {
	baseAudioTS := uint32(1000)
	baseVideoTS := uint32(5000)

	testCases := []struct {
		name     string
		audioTS  uint32
		expected uint32
	}{
		{
			name:     "First frame (20ms)",
			audioTS:  1000 + 960,
			expected: 5000 + 1800,
		},
		{
			name:     "Second frame (40ms)",
			audioTS:  1000 + 1920,
			expected: 5000 + 3600,
		},
		{
			name:     "One second",
			audioTS:  1000 + 48000,
			expected: 5000 + 90000,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := GetCorrelatedVideoTS(tc.audioTS, baseAudioTS, baseVideoTS)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestGetCorrelatedVideoTS_Ratio(t *testing.T) {
	// Verify the ratio is exactly 1.875
	assert.Equal(t, 1.875, ClockRateRatio)
	assert.Equal(t, float64(90000)/float64(48000), ClockRateRatio)
}
