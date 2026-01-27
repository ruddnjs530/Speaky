package transcode

import (
	"fmt"

	"github.com/zaf/resample"
)

// Resampler processes audio sample rate conversion.
// It defines an interface to allow swapping implementations (Pure Go vs CGO) later.
type Resampler interface {
	// Resample converts the input PCM samples to the target sample rate.
	// Returns a NEW slice with converted samples.
	Resample(input []int16) ([]int16, error)
}

// ZafResampler implements Resampler using github.com/zaf/resample (Pure Go).
type ZafResampler struct {
	resampler  *resample.Resampler
	writer     *sliceWriter
	scratchBuf []byte // Reusable buffer for int16->byte conversion
	inputRate  int
	outputRate int
	channels   int
}

// NewResampler creates a new Resampler instance.
// inputRate: Source sample rate (e.g., 48000)
// outputRate: Target sample rate (e.g., 24000)
// channels: Number of channels (must match input data)
func NewResampler(inputRate, outputRate, channels int) (*ZafResampler, error) {
	if inputRate <= 0 || outputRate <= 0 || channels <= 0 {
		return nil, fmt.Errorf("invalid parameters: in=%d, out=%d, ch=%d", inputRate, outputRate, channels)
	}

	sw := &sliceWriter{buf: make([]int16, 0, 1024)}

	r, err := resample.New(sw, float64(inputRate), float64(outputRate), channels, resample.I16, resample.LowQ)
	if err != nil {
		return nil, fmt.Errorf("failed to create resampler: %w", err)
	}

	return &ZafResampler{
		resampler:  r,
		writer:     sw,
		scratchBuf: make([]byte, 0, 2048), // Pre-allocate for typical 20ms frames
		inputRate:  inputRate,
		outputRate: outputRate,
		channels:   channels,
	}, nil
}

// Resample converts input samples.
// This implementation uses a continuous streaming model.
// The internal state of the resampler is preserved between calls.
// Note: Due to filter delay, output size might not perfectly match input size ratio in every single call,
// but it averages out over time.
func (r *ZafResampler) Resample(input []int16) ([]int16, error) {
	// Reset output buffer (sliceWriter)
	r.writer.Reset()

	// Ensure scratch buffer is large enough
	requiredSize := len(input) * 2
	if cap(r.scratchBuf) < requiredSize {
		r.scratchBuf = make([]byte, requiredSize)
	}
	r.scratchBuf = r.scratchBuf[:requiredSize]

	// Convert int16 to bytes (Little Endian)
	for i, s := range input {
		r.scratchBuf[i*2] = byte(s)
		r.scratchBuf[i*2+1] = byte(s >> 8)
	}

	// Write to resampler
	// This automatically writes processed data to r.writer
	_, err := r.resampler.Write(r.scratchBuf)
	if err != nil {
		return nil, fmt.Errorf("resample write failed: %w", err)
	}

	// Capture output from this chunk
	// We do NOT Close() or Flush() here because we want continuous streaming.
	// This preserves the filter state and prevents clicking artifacts.
	output := make([]int16, len(r.writer.buf))
	copy(output, r.writer.buf)

	return output, nil
}

// --- Helpers ---

// sliceWriter implements io.Writer and stores Int16 data derived from bytes
type sliceWriter struct {
	buf []int16
}

func (sw *sliceWriter) Write(p []byte) (n int, err error) {
	if len(p)%2 != 0 {
		return 0, fmt.Errorf("odd byte length for int16 stream")
	}

	// Append to buffer
	nSamples := len(p) / 2
	for i := 0; i < nSamples; i++ {
		// Little Endian assumption (standard for PCM)
		sample := int16(p[i*2]) | int16(p[i*2+1])<<8
		sw.buf = append(sw.buf, sample)
	}

	return len(p), nil
}

func (sw *sliceWriter) Reset() {
	sw.buf = sw.buf[:0]
}
