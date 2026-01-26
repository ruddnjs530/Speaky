package transcode

import (
	"fmt"
	"sync"

	"github.com/hraban/opus"
)

const (
	// DefaultOpusSampleRate is the standard WebRTC audio sample rate
	DefaultOpusSampleRate = 48000
	// DefaultOpusChannels is mono by default (typical for speech)
	DefaultOpusChannels = 1
)

// OpusDecoder decodes Opus RTP payloads into PCM samples.
// It is thread-safe.
type OpusDecoder struct {
	decoder *opus.Decoder
	mu      sync.Mutex
	buffer  []int16 // Pre-allocated buffer for decoding
}

// NewOpusDecoder creates a new Opus decoder.
// sampleRate: typically 48000
// channels: typically 1 or 2
func NewOpusDecoder(sampleRate int, channels int) (*OpusDecoder, error) {
	dec, err := opus.NewDecoder(sampleRate, channels)
	if err != nil {
		return nil, fmt.Errorf("failed to create opus decoder: %w", err)
	}

	return &OpusDecoder{
		decoder: dec,
		buffer:  make([]int16, 1920*channels), // Max frame size (40ms @ 48kHz)
	}, nil
}

// Decode decodes an Opus payload into PCM int16 samples.
// Returns a slice referencing the internal buffer (caller should copy if needed across calls)
// or a newly allocated slice if internal buffer is insufficient (unlikely).
// ⚠️ WARNING: The returned slice points to an internal buffer that is reused in subsequent calls.
// CALLER MUST COPY THE DATA IMMEDIATELY IF RETENTION IS NEEDED BEYOND THE SCOPE.
func (d *OpusDecoder) Decode(opusData []byte) ([]int16, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	n, err := d.decoder.Decode(opusData, d.buffer)
	if err != nil {
		return nil, err
	}

	return d.buffer[:n], nil
}

// OpusEncoder encodes PCM samples into Opus packets.
// It is thread-safe.
type OpusEncoder struct {
	encoder *opus.Encoder
	mu      sync.Mutex
	buffer  []byte // Pre-allocated buffer for encoding
}

// NewOpusEncoder creates a new Opus encoder.
// sampleRate: typically 48000
// channels: typically 1 or 2
func NewOpusEncoder(sampleRate int, channels int) (*OpusEncoder, error) {
	enc, err := opus.NewEncoder(sampleRate, channels, opus.AppVoIP)
	if err != nil {
		return nil, fmt.Errorf("failed to create opus encoder: %w", err)
	}

	return &OpusEncoder{
		encoder: enc,
		buffer:  make([]byte, 1500), // MTU size
	}, nil
}

// Encode encodes PCM int16 samples into an Opus packet.
// pcmData length must correspond to a valid Opus frame duration (e.g. 10, 20, 40, 60ms).
// At 48kHz mono: 480 (10ms), 960 (20ms), 1920 (40ms), etc.
func (e *OpusEncoder) Encode(pcmData []int16) ([]byte, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	n, err := e.encoder.Encode(pcmData, e.buffer)
	if err != nil {
		return nil, err
	}

	// Copy result to avoid race conditions if internal buffer is reused immediately
	result := make([]byte, n)
	copy(result, e.buffer[:n])
	return result, nil
}
