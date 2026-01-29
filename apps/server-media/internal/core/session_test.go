package core

import (
	"testing"
	"time"

	"speaky-media/internal/config"

	"github.com/pion/webrtc/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSession_New verifies that NewSession correctly initializes a session
func TestSession_New(t *testing.T) {
	// Create room
	cfg := &config.Config{}
	api := &webrtc.API{}
	room := NewRoom("test-room", cfg, api, nil, nil)
	defer room.Close()

	// Create peer connection (minimal config for testing)
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)
	defer pc.Close()

	// Create session
	session := NewSession("user-1", room, pc, nil)

	// Verify session is created
	require.NotNil(t, session)
	assert.Equal(t, "user-1", session.ID)
	assert.NotNil(t, session.ctx)
	assert.NotNil(t, session.cancel)

	// Verify peer connection is set
	assert.Equal(t, pc, session.PeerConnection())

	// Verify context is child of room context
	select {
	case <-session.ctx.Done():
		t.Fatal("session context should not be canceled initially")
	default:
		// Expected
	}
}

// TestSession_Close verifies that Close properly cancels the context
func TestSession_Close(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	room := NewRoom("test-room", cfg, api, nil, nil)
	defer room.Close()

	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)

	session := NewSession("user-1", room, pc, nil)

	// Verify context is active
	select {
	case <-session.ctx.Done():
		t.Fatal("context should not be canceled before Close()")
	default:
		// Expected
	}

	// Close session
	err = session.Close()
	require.NoError(t, err)

	// Verify context is canceled
	select {
	case <-session.ctx.Done():
		// Expected
	case <-time.After(100 * time.Millisecond):
		t.Fatal("context should be canceled after Close()")
	}
}

// TestSession_ContextInheritance verifies that session context is canceled when room closes
func TestSession_ContextInheritance(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	room := NewRoom("test-room", cfg, api, nil, nil)

	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)
	defer pc.Close()

	session := NewSession("user-1", room, pc, nil)

	// Verify session context is active
	select {
	case <-session.ctx.Done():
		t.Fatal("session context should not be canceled initially")
	default:
		// Expected
	}

	// Close room (parent context)
	err = room.Close()
	require.NoError(t, err)

	// Session context should also be canceled (context inheritance)
	select {
	case <-session.ctx.Done():
		// Expected: child context canceled when parent is canceled
	case <-time.After(100 * time.Millisecond):
		t.Fatal("session context should be canceled when room closes")
	}
}

// TestSession_AddLocalTrack verifies local track storage
func TestSession_AddLocalTrack(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	room := NewRoom("test-room", cfg, api, nil, nil)
	defer room.Close()

	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)
	defer pc.Close()

	session := NewSession("user-1", room, pc, nil)
	defer session.Close()

	// Create a mock local track
	track, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus},
		"audio",
		"test-stream",
	)
	require.NoError(t, err)

	// Add track
	session.AddLocalTrack("track-1", track)

	// Verify track is stored
	session.mu.Lock()
	storedTrack, exists := session.localTracks["track-1"]
	session.mu.Unlock()

	assert.True(t, exists)
	assert.Equal(t, track, storedTrack)
}

// TestSession_RemoveLocalTrack verifies local track removal (prevents memory leaks)
func TestSession_RemoveLocalTrack(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	room := NewRoom("test-room", cfg, api, nil, nil)
	defer room.Close()

	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)
	defer pc.Close()

	session := NewSession("user-1", room, pc, nil)
	defer session.Close()

	// Create and add track
	track, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus},
		"audio",
		"test-stream",
	)
	require.NoError(t, err)

	session.AddLocalTrack("track-1", track)

	// Verify track exists
	session.mu.Lock()
	_, exists := session.localTracks["track-1"]
	session.mu.Unlock()
	assert.True(t, exists)

	// Remove track
	session.RemoveLocalTrack("track-1")

	// Verify track is removed
	session.mu.Lock()
	_, exists = session.localTracks["track-1"]
	session.mu.Unlock()
	assert.False(t, exists, "track should be removed to prevent memory leak")
}

// TestSession_HandleOffer tests SDP offer/answer exchange
func TestSession_HandleOffer(t *testing.T) {
	t.Skip("SDP negotiation testing requires complex ICE setup; will be tested in integration tests")

	// This test is skipped because proper SDP offer/answer exchange requires:
	// 1. ICE gathering completion
	// 2. DTLS certificate generation
	// 3. Proper async handling of OnICECandidate events
	// These are better tested in integration tests with real peer connections
}
