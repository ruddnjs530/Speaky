package audio

import (
	"bytes"
	"fmt"

	"github.com/zaf/resample"
)

// NewUpsampler creates a resampler for up-sampling (e.g., 16kHz → 48kHz).
// This is the reverse of NewResampler which down-samples (48kHz → 16kHz).
func NewUpsampler(inputSampleRate, outputSampleRate, outputChannels int) (*SoxrResampler, error) {
	outBuf := new(bytes.Buffer)

	res, err := resample.New(
		outBuf,
		float64(inputSampleRate),  // Input Rate (e.g., 16000)
		float64(outputSampleRate), // Output Rate (e.g., 48000)
		outputChannels,
		resample.I16,
		resample.Quick,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create upsampler: %w", err)
	}

	return &SoxrResampler{
		res:    res,
		outBuf: outBuf,
	}, nil
}
