package pipeline

import (
	"context"
	"fmt"
	"io"

	"github.com/pion/rtp"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/audio"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
)

// Transcoder represents a single audio stream processing pipeline.
type Transcoder interface {
	// WriteOpus accepts an Opus RTP packet, decodes it, resamples it, and buffers the result for reading.
	// Typically called by the WebRTC receiver's callback.
	WriteOpus(packet *rtp.Packet) error

	// ReadPCM returns the next chunk of processed audio.
	// Blocks until data is available or the track is closed.
	// Returns io.EOF if the channel is closed.
	ReadPCM(ctx context.Context) (*AudioFrame, error)
}

// OpusToPCMTranscoder implements the Transcoder interface.
// It pipelines decoding and resampling using a buffered channel.
type OpusToPCMTranscoder struct {
	decoder   audio.Decoder
	resampler audio.Resampler

	// pcmChan acts as a thread-safe buffer between WebRTC (Writer) and gRPC (Reader).
	pcmChan chan *AudioFrame
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
		pcmChan:   make(chan *AudioFrame, cfg.PCMBufferSize),
	}, nil
}

// WriteOpus processes the incoming RTP packet and sends it to the channel.
func (t *OpusToPCMTranscoder) WriteOpus(packet *rtp.Packet) error {
	if packet == nil {
		return fmt.Errorf("packet cannot be nil")
	}

	// Extract Payload for decoding
	payload := packet.Payload
	// Note: We deliberately allow empty payload here to support PLC (Packet Loss Concealment) if the decoder supports it.

	// Decode (Opus -> PCM)
	decodedPCM, err := t.decoder.Decode(payload)
	if err != nil {
		return fmt.Errorf("decoding failed: %w", err)
	}

	// Resample
	resampledPCM, err := t.resampler.Resample(decodedPCM)
	if err != nil {
		return fmt.Errorf("resampling failed: %w", err)
	}

	// [BLOCKING] Send to Buffer
	// Bundle with the original RTP Timestamp for Sync at the other end.
	t.pcmChan <- &AudioFrame{
		Data:      resampledPCM,
		Timestamp: packet.Timestamp,
	}

	return nil
}

// ReadPCM retrieves the next processed audio chunk from the buffer.
func (t *OpusToPCMTranscoder) ReadPCM(ctx context.Context) (*AudioFrame, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case frame, ok := <-t.pcmChan:
		if !ok {
			return nil, io.EOF
		}
		return frame, nil
	}
}


