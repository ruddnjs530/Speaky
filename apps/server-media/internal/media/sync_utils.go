package media

// RTP Clock Rate Constants
const (
	// RtpAudioClockRate is the standard clock rate for Opus audio (48kHz)
	RtpAudioClockRate = 48000

	// RtpVideoClockRate is the standard clock rate for VP8/H.264 video (90kHz)
	RtpVideoClockRate = 90000

	// ClockRateRatio is the conversion ratio from Audio to Video timestamps
	// Video / Audio = 90000 / 48000 = 1.875
	ClockRateRatio = float64(RtpVideoClockRate) / float64(RtpAudioClockRate)
)

// GetCorrelatedVideoTS calculates the corresponding Video RTP timestamp
// for a given Audio RTP timestamp using Delta-based correlation.
//
// This handles the RTP Random Offset problem where Audio and Video streams
// start at different random timestamps.
//
// Formula: TargetVideoTS = BaseVideoTS + (AudioTS - BaseAudioTS) × 1.875
//
// Parameters:
//   - audioTS: Current Audio RTP timestamp (from AI response)
//   - baseAudioTS: First Audio RTP timestamp received (baseline)
//   - baseVideoTS: First Video RTP timestamp received (baseline)
//
// Returns:
//   - Correlated Video RTP timestamp to query from VideoQueue
func GetCorrelatedVideoTS(audioTS, baseAudioTS, baseVideoTS uint32) uint32 {
	// Calculate delta from baseline
	audioDelta := audioTS - baseAudioTS

	// Scale to video clock rate
	videoDelta := uint32(float64(audioDelta) * ClockRateRatio)

	// Add to video baseline
	return baseVideoTS + videoDelta
}
