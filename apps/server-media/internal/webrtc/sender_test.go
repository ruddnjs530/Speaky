package webrtc

import (
	"testing"

	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewPionSender(t *testing.T) {
	// Create a peer connection
	config := webrtc.Configuration{}
	pc, err := webrtc.NewPeerConnection(config)
	require.NoError(t, err)
	defer pc.Close()

	// Create sender
	sender, err := NewPionSender(pc)
	require.NoError(t, err)
	assert.NotNil(t, sender)
	assert.NotNil(t, sender.audioTrack)
	assert.NotNil(t, sender.videoTrack)

	// Verify tracks were added to peer connection
	transceivers := pc.GetTransceivers()
	assert.Len(t, transceivers, 2, "Should have 2 transceivers (audio + video)")
}

func TestPionSender_WriteRTP_Audio(t *testing.T) {
	config := webrtc.Configuration{}
	pc, err := webrtc.NewPeerConnection(config)
	require.NoError(t, err)
	defer pc.Close()

	sender, err := NewPionSender(pc)
	require.NoError(t, err)

	// Create audio RTP packet (Opus, PT=111)
	audioPacket := &rtp.Packet{
		Header: rtp.Header{
			Version:        2,
			PayloadType:    111, // Opus
			SequenceNumber: 1,
			Timestamp:      960,
			SSRC:           12345,
		},
		Payload: []byte{0x01, 0x02, 0x03},
	}

	// Write should succeed (even without active connection)
	err = sender.WriteRTP(audioPacket)
	assert.NoError(t, err)
}

func TestPionSender_WriteRTP_Video(t *testing.T) {
	config := webrtc.Configuration{}
	pc, err := webrtc.NewPeerConnection(config)
	require.NoError(t, err)
	defer pc.Close()

	sender, err := NewPionSender(pc)
	require.NoError(t, err)

	// Create video RTP packet (VP8, PT=96)
	videoPacket := &rtp.Packet{
		Header: rtp.Header{
			Version:        2,
			PayloadType:    96, // VP8
			SequenceNumber: 1,
			Timestamp:      3000,
			SSRC:           54321,
		},
		Payload: []byte{0x10, 0x20, 0x30},
	}

	// Write should succeed
	err = sender.WriteRTP(videoPacket)
	assert.NoError(t, err)
}

func TestPionSender_Close(t *testing.T) {
	config := webrtc.Configuration{}
	pc, err := webrtc.NewPeerConnection(config)
	require.NoError(t, err)
	defer pc.Close()

	sender, err := NewPionSender(pc)
	require.NoError(t, err)

	// Close should not error
	err = sender.Close()
	assert.NoError(t, err)
}
