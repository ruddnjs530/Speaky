package media

// This file contains the JoinAsGuest implementation for Room

import (
	"fmt"
	"log/slog"

	"github.com/pion/webrtc/v4"
	mediaWebrtc "lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/webrtc"
)

// JoinAsGuest connects a Guest to the Host's Egress PeerConnection.
// The Guest receives AI-processed audio and synchronized video.
//
// Flow:
//  1. Find the Host participant in the room
//  2. Get Host's Egress PeerConnection (from SFUSender)
//  3. Set Guest's offer as RemoteDescription
//  4. Create answer
//  5. Return answer SDP to Guest
func (r *Room) JoinAsGuest(userID string, sdpOffer string) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	slog.Info("JoinAsGuest called", "user_id", userID, "participant_count", len(r.participants))

	// Find the Host participant (assume first participant is Host for MVP)
	var hostParticipant *Participant
	for id, p := range r.participants {
		slog.Info("Checking participant", "id", id, "has_sender", p.SFUSender != nil)
		if p.SFUSender != nil {
			hostParticipant = p
			break
		}
	}

	if hostParticipant == nil {
		return "", fmt.Errorf("no host found in room (host must join first)")
	}

	// Get Host's Egress PeerConnection
	// We need to access the underlying PeerConnection from SFUSender
	// For now, we'll need to modify PionSender to expose the PC
	pionSender, ok := hostParticipant.SFUSender.(*mediaWebrtc.PionSender)
	if !ok {
		return "", fmt.Errorf("invalid sender type")
	}

	egressPC := pionSender.GetPeerConnection()

	// Set Guest's offer as RemoteDescription
	offer := webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  sdpOffer,
	}

	if err := egressPC.SetRemoteDescription(offer); err != nil {
		return "", fmt.Errorf("failed to set remote description: %w", err)
	}

	// Create answer
	answer, err := egressPC.CreateAnswer(nil)
	if err != nil {
		return "", fmt.Errorf("failed to create answer: %w", err)
	}

	// Set local description
	gatherComplete := webrtc.GatheringCompletePromise(egressPC)
	if err := egressPC.SetLocalDescription(answer); err != nil {
		return "", fmt.Errorf("failed to set local description: %w", err)
	}
	<-gatherComplete

	// Use the updated SDP with candidates
	answer = *egressPC.LocalDescription()

	slog.Info("Guest connected to Host's Egress PC",
		"guest_id", userID,
		"host_id", hostParticipant.ID,
		"room_id", r.ID)

	// Log the answer SDP to debug Payload Types
	slog.Info("Guest SDP Answer", "sdp", answer.SDP)

	return answer.SDP, nil
}
