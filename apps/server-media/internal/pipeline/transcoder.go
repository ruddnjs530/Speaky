package pipeline

import (
	"context"
	"fmt"
	"io"

	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/audio"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
)

// Transcoder represents a single audio stream processing pipeline.
type Transcoder interface {
	// WriteOpus accepts an Opus packet, decodes it, resamples it, and buffers the result for reading.
	// Typically called by the WebRTC receiver's callback.
	WriteOpus(packet []byte) error

	// ReadPCM returns the next chunk of processed audio.
	// Blocks until data is available or the track is closed.
	// Returns io.EOF if the channel is closed.
	ReadPCM(ctx context.Context) ([]byte, error)
}

// OpusToPCMTranscoder implements the Transcoder interface.
// It pipelines decoding and resampling using a buffered channel.
type OpusToPCMTranscoder struct {
	decoder   audio.Decoder
	resampler audio.Resampler

	// pcmChan acts as a thread-safe buffer between WebRTC (Writer) and gRPC (Reader).
	pcmChan chan []byte
}

// NewOpusToPCMTranscoder creates a new instance of OpusToPCMTranscoder.
func NewOpusToPCMTranscoder(cfg *config.Config) (*OpusToPCMTranscoder, error) {
	// Initialize Decoder
	dec, err := audio.NewOpusDecoder(audio.DefaultSampleRate, cfg.AudioChannels)
	if err != nil {
		return nil, fmt.Errorf("failed to create decoder: %w", err)
	}

	// Initialize Resampler
	res, err := audio.NewResampler(cfg.AudioSampleRate, cfg.AudioChannels)
	if err != nil {
		return nil, fmt.Errorf("failed to create resampler: %w", err)
	}

	return &OpusToPCMTranscoder{
		decoder:   dec,
		resampler: res,
		pcmChan:   make(chan []byte, cfg.PCMBufferSize),
	}, nil
}

// WriteOpus processes the incoming packet and sends it to the channel.
func (t *OpusToPCMTranscoder) WriteOpus(packet []byte) error {
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
func (t *OpusToPCMTranscoder) ReadPCM(ctx context.Context) ([]byte, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case data, ok := <-t.pcmChan:
		if !ok {
			return nil, io.EOF
		}
		return data, nil
	}
}


