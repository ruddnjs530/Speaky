package media

import (
	"fmt"

	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/audio"
)

// Track represents a single audio stream processing pipeline.
type Track interface {
	// WriteOpus accepts an Opus packet, decodes it, resamples it, and buffers the result for reading.
	// Typically called by the WebRTC receiver's callback.
	WriteOpus(packet []byte) error

	// ReadPCM returns the next chunk of processed audio.
	// Blocks until data is available or the track is closed.
	ReadPCM() ([]byte, error)

	// GetPCMChannel returns the read-only channel for PCM data.
	// Useful for select/case with context cancellation.
	GetPCMChannel() <-chan []byte
}

// RegularTrack implements the Track interface.
// It pipelines decoding and resampling using a buffered channel.
type RegularTrack struct {
	decoder   audio.Decoder
	resampler audio.Resampler

	// pcmChan acts as a thread-safe buffer between WebRTC (Writer) and gRPC (Reader).
	pcmChan chan []byte
}

// NewRegularTrack creates a new instance of RegularTrack.
func NewRegularTrack() (*RegularTrack, error) {
	// Initialize Decoder
	dec, err := audio.NewOpusDecoder(audio.DefaultSampleRate, audio.DefaultChannels)
	if err != nil {
		return nil, fmt.Errorf("failed to create decoder: %w", err)
	}

	// Initialize Resampler
	res, err := audio.NewResampler()
	if err != nil {
		return nil, fmt.Errorf("failed to create resampler: %w", err)
	}

	return &RegularTrack{
		decoder:   dec,
		resampler: res,
		pcmChan:   make(chan []byte, PCMBufferSize),
	}, nil
}

// WriteOpus processes the incoming packet and sends it to the channel.
func (t *RegularTrack) WriteOpus(packet []byte) error {
	// Decode (Opus -> PCM)
	decodedPCM, err := t.decoder.Decode(packet)
	if err != nil {
		return fmt.Errorf("decoding failed: %w", err)
	}

	// Resample
	resampledPCM, err := t.resampler.Resample(decodedPCM)
	if err != nil {
		return fmt.Errorf("resampling failed: %w", err)
	}

	// [BLOCKING] Send to Buffer
	// TODO: decide whether to implement non-blocking drop logic
	t.pcmChan <- resampledPCM

	return nil
}

// ReadPCM retrieves the next processed audio chunk from the buffer.
func (t *RegularTrack) ReadPCM() ([]byte, error) {
	// Blocks until data is available in the channel.
	data := <-t.pcmChan
	return data, nil
}

// GetPCMChannel returns the read-only channel for receiving PCM data.
func (t *RegularTrack) GetPCMChannel() <-chan []byte {
	return t.pcmChan
}
