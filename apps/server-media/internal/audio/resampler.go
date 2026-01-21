package audio

import (
	"bytes"
	"fmt"

	"github.com/zaf/resample"
)

// Interface

type Resampler interface {
	// Resample converts PCM audio from DefaultSampleRate to TargetSampleRate.
	Resample(input []byte) ([]byte, error)
}

// Implementation

type SoxrResampler struct {
	res    *resample.Resampler
	outBuf *bytes.Buffer // Buffer to capture resampled output
}

// NewResampler creates a new instance of SoxrResampler.
func NewResampler(targetSampleRate, targetChannels int) (*SoxrResampler, error) {
	// Create a buffer to hold the resampled output.
	outBuf := new(bytes.Buffer)

	// Initialize the resampler (libsoxr wrapper).
	res, err := resample.New(
		outBuf,                     // Destination for resampled data
		float64(DefaultSampleRate), // Input Rate
		float64(targetSampleRate),  // Output Rate
		targetChannels,             // Channels
		resample.I16,               // Format: 16-bit Little Endian
		resample.Quick,             // Quality
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resampler: %w", err)
	}

	return &SoxrResampler{
		res:    res,
		outBuf: outBuf,
	}, nil
}

// Resample implements the Resampler interface.
func (r *SoxrResampler) Resample(input []byte) ([]byte, error) {
	// Reset the buffer to clear data from the previous call.
	r.outBuf.Reset()

	// Write input data to the resampler.
	// This triggers the resampling process and writes the result to r.outBuf.
	_, err := r.res.Write(input)
	if err != nil {
		return nil, fmt.Errorf("resample failed: %w", err)
	}

	// Retrieve the resampled data from the buffer.
	// Make a copy because the buffer will be reset on the next call.
	output := make([]byte, r.outBuf.Len())
	copy(output, r.outBuf.Bytes())

	return output, nil
}
