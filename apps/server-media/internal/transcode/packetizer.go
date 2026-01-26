package transcode

import (
	"github.com/pion/rtp"
)

const (
	// SamplesPerFrame20ms at 48kHz: 48000 * 0.020 = 960
	SamplesPerFrame20ms = 960
)

// RTPPacketizer splits Opus frames into valid RTP packets.
// CRITICAL: It generates independent monotonic timestamps to handle AI-translated audio duration mismatches.
type RTPPacketizer struct {
	ssrc           uint32
	payloadType    uint8
	sequenceNumber uint16
	timestamp      uint32
	mtu            int
}

// NewRTPPacketizer creates a packetizer with a fresh random SSRC (or specified) and starting state.
// ssrc: Synchronization Source identifier
// payloadType: typically 111 for Opus
// mtu: Max Transfer Unit, typically 1200-1500
func NewRTPPacketizer(ssrc uint32, payloadType uint8, mtu int) *RTPPacketizer {
	return &RTPPacketizer{
		ssrc:           ssrc,
		payloadType:    payloadType,
		sequenceNumber: 0, // Should nominally be random, but 0 is fine for internal generation
		timestamp:      0, // Start at 0, internal monotonic clock
		mtu:            mtu,
	}
}

// Packetize splits distinct Opus frames into RTP packets.
// Input: opusFrames is a list of encoded Opus frames (each []byte).
// Output: list of *rtp.Packet ready to send.
//
// ⚠️ TIMESTAMPS: This function ignores any previous timestamp logic and applies strict monotonic time.
// It assumes EACH input frame is exactly 20ms of audio (960 samples).
// If AI returns variable length chunks, they MUST be encoded into 20ms Opus frames before passing here.
func (p *RTPPacketizer) Packetize(opusFrames [][]byte) ([]*rtp.Packet, error) {
	packets := make([]*rtp.Packet, 0, len(opusFrames))

	for _, frame := range opusFrames {
		if len(frame) > p.mtu {
			// Review feedback: Drop frame instead of failing the whole stream
			// Ideally we should log a warning here.
			// skipping this frame
			continue
		}

		pkt := &rtp.Packet{
			Header: rtp.Header{
				Version:        2,
				Padding:        false,
				Extension:      false,
				Marker:         false, // Audio frames usually don't need Marker, or only on talk-spurt start.
				PayloadType:    p.payloadType,
				SequenceNumber: p.sequenceNumber,
				Timestamp:      p.timestamp,
				SSRC:           p.ssrc,
			},
			Payload: frame,
		}

		packets = append(packets, pkt)

		// Increment state
		p.sequenceNumber++
		p.timestamp += SamplesPerFrame20ms // Always increment by 960 (20ms)
	}

	return packets, nil
}
