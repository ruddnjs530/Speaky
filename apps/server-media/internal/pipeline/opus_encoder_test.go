package pipeline

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewOpusEncoder(t *testing.T) {
	encoder, err := NewOpusEncoder(16000, 1, 0)
	require.NoError(t, err)
	assert.NotNil(t, encoder)
	assert.Equal(t, uint32(0), encoder.currentTS)
}

func TestOpusEncoder_Encode_UpsamplingRatio(t *testing.T) {
	encoder, err := NewOpusEncoder(16000, 1, 0)
	require.NoError(t, err)

	// Create 16kHz PCM input (20ms frame)
	// 16000 * 0.02 = 320 samples * 2 bytes = 640 bytes
	inputSamples := 320
	inputData := make([]byte, inputSamples*2)
	for i := 0; i < len(inputData); i++ {
		inputData[i] = byte(i % 256)
	}

	frame := &AudioFrame{
		Data:      inputData,
		Timestamp: 48000, // Ingestion TS (not used for RTP header)
	}

	// Encode
	packet, err := encoder.Encode(frame)
	require.NoError(t, err)
	assert.NotNil(t, packet)

	// Verify RTP packet structure
	assert.Equal(t, uint8(2), packet.Version)
	assert.Equal(t, uint8(111), packet.PayloadType) // Opus
	assert.Greater(t, len(packet.Payload), 0, "Opus payload should not be empty")
}

func TestOpusEncoder_Encode_TimestampIncrement(t *testing.T) {
	initialTS := uint32(1000)
	encoder, err := NewOpusEncoder(16000, 1, initialTS)
	require.NoError(t, err)

	// Create dummy input
	inputData := make([]byte, 320*2) // 16kHz, 20ms
	frame := &AudioFrame{
		Data:      inputData,
		Timestamp: 48000,
	}

	// Encode multiple frames
	timestamps := []uint32{}
	for i := 0; i < 5; i++ {
		packet, err := encoder.Encode(frame)
		require.NoError(t, err)
		timestamps = append(timestamps, packet.Timestamp)
	}

	// Verify monotonic increase
	expected := []uint32{
		initialTS,
		initialTS + 960,
		initialTS + 1920,
		initialTS + 2880,
		initialTS + 3840,
	}
	assert.Equal(t, expected, timestamps, "Timestamps should increment by 960 (20ms at 48kHz)")
}

func TestOpusEncoder_Encode_IgnoresIngestionTimestamp(t *testing.T) {
	encoder, err := NewOpusEncoder(16000, 1, 0)
	require.NoError(t, err)

	inputData := make([]byte, 320*2)

	// Frame 1: Ingestion TS = 48000
	frame1 := &AudioFrame{Data: inputData, Timestamp: 48000}
	packet1, err := encoder.Encode(frame1)
	require.NoError(t, err)

	// Frame 2: Ingestion TS = 96000 (different)
	frame2 := &AudioFrame{Data: inputData, Timestamp: 96000}
	packet2, err := encoder.Encode(frame2)
	require.NoError(t, err)

	// Egress TS should be independent (0, 960)
	assert.Equal(t, uint32(0), packet1.Timestamp)
	assert.Equal(t, uint32(960), packet2.Timestamp)
	assert.NotEqual(t, frame1.Timestamp, packet1.Timestamp, "Should NOT use Ingestion TS")
	assert.NotEqual(t, frame2.Timestamp, packet2.Timestamp, "Should NOT use Ingestion TS")
}

func TestOpusEncoder_Constants(t *testing.T) {
	// Verify critical constants
	assert.Equal(t, 48000, EgressSampleRate)
	assert.Equal(t, 2, EgressChannels)
	assert.Equal(t, 20, FrameDurationMs)
	assert.Equal(t, 960, SamplesPerFrame) // 48000 * 0.02
	assert.Equal(t, 960, TimestampIncrement)
}
