package audio_test

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/audio"
)

func TestOpusDecoder_Decode(t *testing.T) {
	decoder, err := audio.NewOpusDecoder(audio.DefaultSampleRate, 1)
	assert.NoError(t, err)
	assert.NotNil(t, decoder)

	validOpusPacket := []byte{0xF8, 0xFF, 0xFE}

	pcmData, err := decoder.Decode(validOpusPacket)

	assert.NoError(t, err)

	expectedSamples := audio.DefaultSampleRate * audio.PLCDurationMs / 1000
	expectedSize := expectedSamples * 1 * 2

	assert.Equal(t, expectedSize, len(pcmData), "Decoded PCM size mismatch")
	assert.NotEmpty(t, pcmData)
}

func TestOpusDecoder_PacketLossConcealment(t *testing.T) {
	decoder, err := audio.NewOpusDecoder(audio.DefaultSampleRate, 1)
	assert.NoError(t, err)

	pcmData, err := decoder.Decode(nil)

	assert.NoError(t, err, "Decoder should handle nil input gracefully (PLC)")
	assert.NotEmpty(t, pcmData, "Decoder should generate audio data during PLC")

	expectedSamples := audio.DefaultSampleRate * audio.PLCDurationMs / 1000
	expectedSize := expectedSamples * 1 * 2
	assert.Equal(t, expectedSize, len(pcmData), "PLC generated audio size mismatch")
}

func TestOpusDecoder_Decode_CorruptData(t *testing.T) {
	decoder, err := audio.NewOpusDecoder(audio.DefaultSampleRate, 1)
	assert.NoError(t, err)

	garbagePacket := []byte{0xFF, 0xFF, 0xFF, 0xFF}

	pcmData, err := decoder.Decode(garbagePacket)

	assert.Error(t, err, "Decoder should return error for corrupt data")
	assert.Nil(t, pcmData, "Should return nil data on error")
}

func TestNewOpusDecoder_Validation(t *testing.T) {
	invalidRate := 573
	_, err := audio.NewOpusDecoder(invalidRate, 1)

	assert.Error(t, err, "Should fail for unsupported sample rate")

	expectedMsg := fmt.Sprintf("%dHz", audio.DefaultSampleRate)
	assert.Contains(t, err.Error(), expectedMsg, "Error message should mention supported rate")

	dec, err := audio.NewOpusDecoder(audio.DefaultSampleRate, 1)
	assert.NoError(t, err)
	assert.NotNil(t, dec)
}
