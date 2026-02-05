package core

import (
	"context"
	"testing"
	"time"

	"speaky-media/internal/config"
	"speaky-media/internal/pipeline"
	"speaky-media/internal/transcode"
	"speaky-media/internal/upstream"

	"github.com/pion/rtp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAudioProcessor_EndToEnd(t *testing.T) {
	// 1. Setup Mock AI Client
	mockClient := upstream.NewMockVoiceProcessor()
	mockClient.SimulateDelay = 10 * time.Millisecond

	// 2. Setup AudioProcessor
	outQueue := pipeline.NewQueue[pipeline.RTPPacket](10)
	processor, err := NewAudioProcessor(&config.Config{
		AudioSampleRate:    48000,
		AudioChannels:      1,
		AIBufferDuration:   20,
		AudioFrameDuration: 20,
	}, mockClient, outQueue, 1, 1.0)
	require.NoError(t, err)

	// 3. Create Input Channel
	inputChan := make(chan pipeline.RTPPacket, 10)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 4. Start Processor
	errChan := make(chan error, 1)
	go func() {
		errChan <- processor.Start(ctx, inputChan)
	}()

	// 5. Generate Valid Opus Input
	// We need valid Opus data so the decoder doesn't fail.
	// Use an encoder to generate it.
	encoder, err := transcode.NewOpusEncoder(48000, 1)
	require.NoError(t, err)

	pcmInput := make([]int16, 960) // 20ms at 48kHz
	// Fill with silence or pattern
	for i := range pcmInput {
		pcmInput[i] = int16(i % 100)
	}

	opusData, err := encoder.Encode(pcmInput)
	require.NoError(t, err)

	// Create RTP Packet
	pkt := &rtp.Packet{
		Header: rtp.Header{
			Version:        2,
			PayloadType:    111,
			SequenceNumber: 1,
			Timestamp:      0,
			SSRC:           12345,
		},
		Payload: opusData,
	}

	// 6. Push Input
	payload, err := pkt.Marshal()
	require.NoError(t, err)

	inputChan <- pipeline.RTPPacket{
		Data:        payload,
		ArrivalTime: time.Now(),
	}

	// 7. Verify Output
	// The mock echoes the data back.
	// AudioProcessor should: Decode -> Send to Mock -> Receive -> Encode -> Packetize -> Push to Queue

	// Wait for output
	var result pipeline.RTPPacket
	select {
	case <-time.After(1 * time.Second):
		t.Fatal("Timeout waiting for processed audio")
	default:
		// Poll queue
		require.Eventually(t, func() bool {
			if outQueue.Len() > 0 {
				res, err := outQueue.Pop(context.Background())
				if err == nil {
					result = res
					return true
				}
			}
			return false
		}, 1*time.Second, 10*time.Millisecond)
	}

	assert.NotNil(t, result.Data)
	assert.Greater(t, len(result.Data), 12, "Result should be valid RTP packet (>12 bytes header)")

	// Check if loop is running without error
	select {
	case err := <-errChan:
		require.NoError(t, err, "Processor stopped unexpectedly")
	default:
	}

	t.Log("AudioProcessor successfully processed packet")
}
