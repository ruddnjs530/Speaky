package webrtc

import (
	"fmt"
	"io"
	"log/slog"
	"strings"

	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
)

// Receiver defines the behavior of a WebRTC audio receiver.
type Receiver interface {
	Connect(offerSDP string) (answerSDP string, err error)
	OnAudioPacket(callback func(packet *rtp.Packet))
	OnVideoPacket(callback func(packet *rtp.Packet))
	AddICECandidate(candidate webrtc.ICECandidateInit) error
	Close() error
}

// PionReceiver implements Receiver using the Pion WebRTC library.
type PionReceiver struct {
	pc             *webrtc.PeerConnection
	onAudioHandler func(*rtp.Packet)
	onVideoHandler func(*rtp.Packet)
	api            *webrtc.API
	cfg            *config.Config
}

// NewReceiver creates a new instance of PionReceiver.
func NewReceiver(api *webrtc.API, cfg *config.Config) *PionReceiver {
	return &PionReceiver{
		api: api,
		cfg: cfg,
	}
}

// Connect performs the SDP handshake and sets up the audio track listener.
func (r *PionReceiver) Connect(offerSDP string) (string, error) {
	// Prepare ICE configuration with STUN/TURN servers from config.
	iceServers := []webrtc.ICEServer{
		{URLs: []string{r.cfg.STUNServer}},
	}

	if r.cfg.TURNServer != "" {
		iceServers = append(iceServers, webrtc.ICEServer{
			URLs:           []string{r.cfg.TURNServer},
			Username:       r.cfg.TURNUsername,
			Credential:     r.cfg.TURNCredential,
			CredentialType: webrtc.ICECredentialTypePassword,
		})
	}

	config := webrtc.Configuration{
		ICEServers: iceServers,
	}

	var err error

	// Create a new PeerConnection using the Injected API.
	r.pc, err = r.api.NewPeerConnection(config)
	if err != nil {
		return "", fmt.Errorf("failed to create peer connection: %w", err)
	}

	// Register a handler for incoming tracks.
	// Triggered when the client starts sending media.
	r.pc.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		slog.Debug("Track received", "kind", track.Kind(), "mime", track.Codec().MimeType)

		// MimeType Splitting (Audio vs Video)
		kind := track.Kind()
		mime := strings.ToLower(track.Codec().MimeType)

		if kind == webrtc.RTPCodecTypeAudio && strings.Contains(mime, "opus") {
			go r.readTrackLoop(track, true)
		} else if kind == webrtc.RTPCodecTypeVideo && (strings.Contains(mime, "vp8") || strings.Contains(mime, "h264")) {
			go r.readTrackLoop(track, false)
		} else {
			slog.Warn("Ignoring unknown track type", "mime", mime)
		}
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

	// 1. Create a channel to wait for ICE Gathering to complete.
	gatherComplete := webrtc.GatheringCompletePromise(r.pc)

	// 2. Set the Local Description (Server's Answer).
	// This triggers ICE candidate gathering.
	if err = r.pc.SetLocalDescription(answer); err != nil {
		return "", fmt.Errorf("failed to set local description: %w", err)
	}

	// 3. Block until ICE Gathering is complete.
	<-gatherComplete

	// 4. Return the final SDP containing all candidates.
	return r.pc.LocalDescription().SDP, nil
}

// readTrackLoop continuously reads RTP packets from the track.
func (r *PionReceiver) readTrackLoop(track *webrtc.TrackRemote, isAudio bool) {
	for {
		// Read RTP packet directly to preserve header info (Sequence, Timestamp)
		packet, _, err := track.ReadRTP()
		if err != nil {
			if err == io.EOF {
				return // Connection closed
			}
			slog.Error("Error reading track RTP", "error", err)
			return
		}

		// Dispatch to appropriate handler
		if isAudio {
			if r.onAudioHandler != nil {
				r.onAudioHandler(packet)
			}
		} else {
			if r.onVideoHandler != nil {
				r.onVideoHandler(packet)
			}
		}
	}
}

// OnAudioPacket registers the callback function for incoming audio packets.
func (r *PionReceiver) OnAudioPacket(callback func(packet *rtp.Packet)) {
	r.onAudioHandler = callback
}

// OnVideoPacket registers the callback function for incoming video packets.
func (r *PionReceiver) OnVideoPacket(callback func(packet *rtp.Packet)) {
	r.onVideoHandler = callback
}

// AddICECandidate adds a new ICE candidate to the peer connection.
// This supports Trickle ICE where candidates are exchanged incrementally.
func (r *PionReceiver) AddICECandidate(candidate webrtc.ICECandidateInit) error {
	if r.pc == nil {
		return fmt.Errorf("peer connection not initialized")
	}
	return r.pc.AddICECandidate(candidate)
}

// Close terminates the peer connection.
func (r *PionReceiver) Close() error {
	if r.pc != nil {
		return r.pc.Close()
	}
	return nil
}
