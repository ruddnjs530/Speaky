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

func TestGetCorrelatedVideoTS_Rollover(t *testing.T) {
    // Scenario: Timestamp wraps around from max uint32 to 0
    baseAudioTS := uint32(4294967000) 
    baseVideoTS := uint32(2000000000) 
    
    // Audio wraps: 4294967000 -> (296 ticks) -> 0 -> (300 ticks) -> 300
    // Total Audio Delta = 596 ticks
    audioTS := uint32(300)
    
    // Expected Calculation (Manual Verification):
    // Audio Delta = 596
    // Video Delta = 596 * 1.875 = 1117.5 -> 1117 (int32 cast truncates)
    // Expected Video TS = 2000000000 + 1117 = 2000001117
    expected := uint32(2000001117)
    
    result := GetCorrelatedVideoTS(audioTS, baseAudioTS, baseVideoTS)
    
    // 1. 값의 정확성 검증 (로직 복사가 아닌 결과값 비교)
    assert.Equal(t, expected, result, "Should calculate correct video TS across rollover")

    // 2. 내부 로직(Delta) 검증을 위한 보조 확인
    // (선택 사항: 만약 내부 delta도 확인하고 싶다면)
    realDelta := int32(audioTS - baseAudioTS)
    assert.Equal(t, int32(596), realDelta, "Sanity check: Audio delta should be 596")
}
