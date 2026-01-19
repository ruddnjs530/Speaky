package webrtc

import (
	"fmt"
	"io"
	"log/slog"

	"github.com/pion/webrtc/v4"
)

// Receiver defines the behavior of a WebRTC audio receiver.
type Receiver interface {
	Connect(offerSDP string) (answerSDP string, err error)
	OnAudioPacket(callback func(packet []byte))
	Close() error
}

// PionReceiver implements Receiver using the Pion WebRTC library.
type PionReceiver struct {
	pc              *webrtc.PeerConnection
	onPacketHandler func([]byte)
}

// NewReceiver creates a new instance of PionReceiver.
func NewReceiver() *PionReceiver {
	return &PionReceiver{}
}

// Connect performs the SDP handshake and sets up the audio track listener.
func (r *PionReceiver) Connect(offerSDP string) (string, error) {
	// Prepare ICE configuration with a STUN server.
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{URLs: []string{DefaultSTUNServer}},
		},
	}

	var err error

	// Create a new PeerConnection.
	r.pc, err = webrtc.NewPeerConnection(config)
	if err != nil {
		return "", fmt.Errorf("failed to create peer connection: %w", err)
	}

	// Register a handler for incoming tracks.
	// Triggered when the client starts sending media.
	r.pc.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		// Ignore non-audio tracks.
		if track.Kind() != webrtc.RTPCodecTypeAudio {
			return
		}
		// Start reading packets in a separate goroutine.
		go r.readTrackLoop(track)
	})

	// Set the Remote Description (Client's Offer).
	offer := webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  offerSDP,
	}
	if err = r.pc.SetRemoteDescription(offer); err != nil {
		return "", fmt.Errorf("failed to set remote description: %w", err)
	}

	// Create an Answer.
	answer, err := r.pc.CreateAnswer(nil)
	if err != nil {
		return "", fmt.Errorf("failed to create answer: %w", err)
	}

	// Set the Local Description (Server's Answer).
	// This triggers ICE candidate gathering.
	if err = r.pc.SetLocalDescription(answer); err != nil {
		return "", fmt.Errorf("failed to set local description: %w", err)
	}

	return answer.SDP, nil
}

// readTrackLoop continuously reads RTP packets from the track.
func (r *PionReceiver) readTrackLoop(track *webrtc.TrackRemote) {
	buf := make([]byte, ReadBufferSize)

	for {
		// Read data from the track (blocks until data arrives).
		n, _, err := track.Read(buf)
		if err != nil {
			if err == io.EOF {
				return // Connection closed
			}
			slog.Error("Error reading track", "error", err)
			return
		}

		// Invoke the registered callback with the audio data.
		if r.onPacketHandler != nil {
			// Copy data to prevent race conditions as buffer is reused.
			packetCopy := make([]byte, n)
			copy(packetCopy, buf[:n])
			r.onPacketHandler(packetCopy)
		}
	}
}

// OnAudioPacket registers the callback function for incoming audio packets.
func (r *PionReceiver) OnAudioPacket(callback func(packet []byte)) {
	r.onPacketHandler = callback
}

// Close terminates the peer connection.
func (r *PionReceiver) Close() error {
	if r.pc != nil {
		return r.pc.Close()
	}
	return nil
}
