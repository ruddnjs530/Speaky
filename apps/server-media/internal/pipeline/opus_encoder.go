package pipeline

import (
	"encoding/binary"
	"fmt"

	"github.com/hraban/opus"
	"github.com/pion/rtp"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/audio"
)

const (
	// EgressSampleRate is the target sample rate for Egress (Opus standard)
	EgressSampleRate = 48000

	// EgressChannels is the number of audio channels for Egress
	EgressChannels = 2

	// FrameDurationMs is the Opus frame duration (20ms standard)
	FrameDurationMs = 20

	// SamplesPerFrame is the number of samples in a 20ms frame at 48kHz
	// 48000 * 0.02 = 960
	SamplesPerFrame = EgressSampleRate * FrameDurationMs / 1000

	// TimestampIncrement is the RTP timestamp increment per frame
	// Same as SamplesPerFrame for audio
	TimestampIncrement = SamplesPerFrame
)

// OpusEncoder encodes PCM audio to Opus format for Egress streaming.
// It handles up-sampling from AI's output rate (16kHz) to Opus standard (48kHz)
// and maintains an independent RTP timestamp sequence for the Egress stream.
type OpusEncoder struct {
	upsampler    audio.Resampler // Use interface
	encoder      *opus.Encoder
	currentTS    uint32 // Independent Egress RTP timestamp
	pcmBuffer    []int16
	opusBuffer   []byte
	stereoBuffer []byte // Pre-allocated buffer for mono→stereo conversion
}

// NewOpusEncoder creates a new Opus encoder with up-sampling support.
//
// Parameters:
//   - inputSampleRate: AI output sample rate (typically 16000)
//   - inputChannels: Number of input channels (typically 1)
//   - initialTS: Starting RTP timestamp (0 or random)
func NewOpusEncoder(inputSampleRate, inputChannels int, initialTS uint32) (*OpusEncoder, error) {
	// Create up-sampler (16kHz → 48kHz)
	upsampler, err := audio.NewUpsampler(inputSampleRate, EgressSampleRate, EgressChannels)
	if err != nil {
		return nil, fmt.Errorf("failed to create upsampler: %w", err)
	}

	// Create Opus encoder (48kHz, 2 channels)
	encoder, err := opus.NewEncoder(EgressSampleRate, EgressChannels, opus.AppVoIP)
	if err != nil {
		return nil, fmt.Errorf("failed to create opus encoder: %w", err)
	}

	// Calculate max stereo buffer size
	// 16kHz * 20ms * 2 channels * 2 bytes/sample = 1280 bytes
	// Add margin for safety
	maxStereoSize := 2000

	return &OpusEncoder{
		upsampler:    upsampler, // Interface type
		encoder:      encoder,
		currentTS:    initialTS,
		pcmBuffer:    make([]int16, SamplesPerFrame*EgressChannels),
		opusBuffer:   make([]byte, 4000), // Max Opus frame size
		stereoBuffer: make([]byte, maxStereoSize),
	}, nil
}

// Close releases resources held by the encoder.
// This should be called when the encoder is no longer needed.
func (e *OpusEncoder) Close() error {
	// Note: libsoxr resampler doesn't have explicit Close in the wrapper
	// but we provide this for future-proofing and consistency
	return nil
}

// Encode converts PCM audio to an RTP packet with Opus payload.
//
// The input AudioFrame contains:
//   - Data: PCM bytes at input sample rate (e.g., 16kHz mono)
//   - Timestamp: Ingestion RTP timestamp (used for correlation only, NOT for RTP header)
//
// Returns an RTP packet with:
//   - Independent Egress timestamp (currentTS)
//   - Opus-encoded payload
func (e *OpusEncoder) Encode(frame *AudioFrame) (*rtp.Packet, error) {
	// Step 1: Convert mono to stereo (duplicate channel) using pre-allocated buffer
	// AI typically outputs mono, but Opus encoder expects stereo
	stereoSize := len(frame.Data) * 2
	if stereoSize > len(e.stereoBuffer) {
		return nil, fmt.Errorf("stereo data too large: %d > %d", stereoSize, len(e.stereoBuffer))
	}

	// Inline mono→stereo conversion to avoid allocation
	for i := 0; i < len(frame.Data); i += 2 {
		// Copy left channel
		e.stereoBuffer[i*2] = frame.Data[i]
		e.stereoBuffer[i*2+1] = frame.Data[i+1]
		// Duplicate to right channel
		e.stereoBuffer[i*2+2] = frame.Data[i]
		e.stereoBuffer[i*2+3] = frame.Data[i+1]
	}
	stereoData := e.stereoBuffer[:stereoSize]

	// Step 2: Up-sample (16kHz → 48kHz)
	upsampled, err := e.upsampler.Resample(stereoData)
	if err != nil {
		return nil, fmt.Errorf("upsampling failed: %w", err)
	}

	// Step 3: Convert bytes to int16 for Opus encoder
	// Note: Resampler output may have slight size variation due to libsoxr characteristics
	expectedSize := len(e.pcmBuffer) * 2
	if len(upsampled) < expectedSize-100 || len(upsampled) > expectedSize+100 {
		return nil, fmt.Errorf("upsampled size out of range: got %d, expected ~%d", len(upsampled), expectedSize)
	}

	// Truncate or pad to exact size if needed
	if len(upsampled) > expectedSize {
		upsampled = upsampled[:expectedSize]
	} else if len(upsampled) < expectedSize {
		// Pad with zeros
		padded := make([]byte, expectedSize)
		copy(padded, upsampled)
		upsampled = padded
	}

	for i := 0; i < len(e.pcmBuffer); i++ {
		e.pcmBuffer[i] = int16(binary.LittleEndian.Uint16(upsampled[i*2:]))
	}

	// Step 4: Opus encode
	n, err := e.encoder.Encode(e.pcmBuffer, e.opusBuffer)
	if err != nil {
		return nil, fmt.Errorf("opus encoding failed: %w", err)
	}

	// Step 5: Create RTP packet with independent Egress timestamp
	packet := &rtp.Packet{
		Header: rtp.Header{
			Version:        2,
			PayloadType:    111, // Opus payload type (standard)
			Timestamp:      e.currentTS,
			SequenceNumber: 0, // Will be set by RTP sender
			SSRC:           0, // Will be set by RTP sender
		},
		Payload: e.opusBuffer[:n],
	}

	// Step 6: Increment timestamp for next frame
	e.currentTS += TimestampIncrement

	return packet, nil
}
