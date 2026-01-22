package webrtc

import (
	"fmt"

	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
)

// Sender represents an SFU sender that broadcasts media to clients.
type Sender interface {
	// WriteRTP writes an RTP packet to the appropriate track (audio or video).
	// The packet's PayloadType determines which track to use.
	WriteRTP(packet *rtp.Packet) error

	// Close releases resources held by the sender.
	Close() error
}

// PionSender implements Sender using Pion WebRTC.
type PionSender struct {
	pc         *webrtc.PeerConnection
	audioTrack *webrtc.TrackLocalStaticRTP
	videoTrack *webrtc.TrackLocalStaticRTP
}

// NewPionSender creates a new SFU sender with audio and video tracks.
func NewPionSender(pc *webrtc.PeerConnection) (*PionSender, error) {
	// Create audio track (Opus)
	audioTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{
			MimeType:  webrtc.MimeTypeOpus,
			ClockRate: 48000,
			Channels:  2,
		},
		"audio",
		"pion-audio",
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create audio track: %w", err)
	}

	// Create video track (VP8)
	videoTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{
			MimeType:  webrtc.MimeTypeVP8,
			ClockRate: 90000,
		},
		"video",
		"pion-video",
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create video track: %w", err)
	}

	// Add tracks to peer connection
	if _, err = pc.AddTrack(audioTrack); err != nil {
		return nil, fmt.Errorf("failed to add audio track: %w", err)
	}

	if _, err = pc.AddTrack(videoTrack); err != nil {
		return nil, fmt.Errorf("failed to add video track: %w", err)
	}

	return &PionSender{
		pc:         pc,
		audioTrack: audioTrack,
		videoTrack: videoTrack,
	}, nil
}

// WriteRTP writes an RTP packet to the appropriate track based on payload type.
//
// Payload Type mapping:
//   - 111: Opus (Audio)
//   - 96-127: Video (VP8/H.264)
func (s *PionSender) WriteRTP(packet *rtp.Packet) error {
	switch packet.PayloadType {
	case 111: // Opus
		// Force standard Opus PT
		packet.PayloadType = 111
		return s.audioTrack.WriteRTP(packet)
	default: // Video (VP8)
		// Force standard VP8 PT (96) - Fixes mismatch with dynamic ingress PTs
		packet.PayloadType = 96
		return s.videoTrack.WriteRTP(packet)
	}
}

// GetPeerConnection returns the underlying PeerConnection.
// This is used for Guest connections to the Egress PC.
func (s *PionSender) GetPeerConnection() *webrtc.PeerConnection {
	return s.pc
}

// Close releases resources held by the sender.
func (s *PionSender) Close() error {
	// Tracks are cleaned up when PeerConnection closes
	return nil
}

var _ Sender = (*PionSender)(nil)
