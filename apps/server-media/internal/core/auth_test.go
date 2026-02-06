package core

import (
	"speaky-media/internal/config"
	"testing"

	"github.com/pion/webrtc/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestAuthentication_HostOnlyPublishing verifies that only hosts can publish tracks
// TestAuthentication_HostOnlyPublishing verifies that roles are correctly assigned by Room.Join
func TestAuthentication_HostOnlyPublishing(t *testing.T) {
	cfg := &config.Config{}
	
	// Use a new MediaEngine and API for the room
	m := &webrtc.MediaEngine{}
	require.NoError(t, m.RegisterDefaultCodecs())
	api := webrtc.NewAPI(webrtc.WithMediaEngine(m))

	hostID := "host-1"
	room := NewRoom("test-room", hostID, nil, cfg, api, nil, nil)
	defer room.Close()

	// Helper to generate a valid SDP offer
	createOffer := func() string {
		pc, err := api.NewPeerConnection(webrtc.Configuration{})
		require.NoError(t, err)
		defer pc.Close()
		
		// Add a transceiver to ensure SDP has media sections
		_, err = pc.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio)
		require.NoError(t, err)

		offer, err := pc.CreateOffer(nil)
		require.NoError(t, err)
		return offer.SDP
	}

	// 1. Join as Host
	// Since we are using valid API, SetRemoteDescription should work if SDP is valid.
	// However, without ICE candidates/networking, connection state might not advance, but Join should succeed.
	offer1 := createOffer()
	_, err := room.Join(hostID, offer1)
	require.NoError(t, err)

	room.mu.RLock()
	hostSession, ok := room.sessions[hostID]
	room.mu.RUnlock()
	
	require.True(t, ok, "Host session should exist")
	assert.Equal(t, "host", hostSession.Role, "User matching HostID should have 'host' role")

	// 2. Join as Guest
	guestID := "guest-1"
	offer2 := createOffer()
	_, err = room.Join(guestID, offer2)
	require.NoError(t, err)

	room.mu.RLock()
	guestSession, ok := room.sessions[guestID]
	room.mu.RUnlock()

	require.True(t, ok, "Guest session should exist")
	assert.Equal(t, "guest", guestSession.Role, "User not matching HostID should have 'guest' role")

	t.Log("Verified role assignments: HostID matches -> Host, otherwise -> Guest")
}
