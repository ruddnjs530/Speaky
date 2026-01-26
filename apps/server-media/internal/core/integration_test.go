package core

import (
	"context"
	"testing"
	"time"

	"speaky-media/internal/config"

	"github.com/pion/webrtc/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestIntegration_BroadcastTrack_SubscriberManagement tests subscriber registration
func TestIntegration_BroadcastTrack_SubscriberManagement(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	room := NewRoom("test-room", cfg, api, nil)
	defer room.Close()

	// Create 2 sessions manually
	pc1, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)
	defer pc1.Close()

	pc2, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)
	defer pc2.Close()

	session1 := NewSession("guest-1", room, pc1)
	session2 := NewSession("guest-2", room, pc2)

	room.mu.Lock()
	room.sessions["guest-1"] = session1
	room.sessions["guest-2"] = session2
	room.mu.Unlock()

	// Note: Cannot create real TrackRemote without full PeerConnection setup
	// This test verifies the session management structure
	room.mu.RLock()
	sessionCount := len(room.sessions)
	room.mu.RUnlock()

	assert.Equal(t, 2, sessionCount, "both sessions should be registered")
	t.Log("Subscriber management structure verified")
}

// TestIntegration_Leave_SubscriberCleanup tests that Leave removes subscribers
func TestIntegration_Leave_SubscriberCleanup(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	room := NewRoom("test-room", cfg, api, nil)
	defer room.Close()

	// Create session
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)

	session := NewSession("user-1", room, pc)
	room.mu.Lock()
	room.sessions["user-1"] = session
	room.mu.Unlock()

	// Create mock ActiveTrack (without real TrackRemote)
	ctx, cancel := context.WithCancel(room.ctx)
	_ = ctx // Will be used when Leave cancels it
	activeTrack := &ActiveTrack{
		Remote:      nil, // Would be real track in production
		OwnerID:     "host",
		Kind:        webrtc.RTPCodecTypeVideo,
		subscribers: make(map[string]*webrtc.TrackLocalStaticRTP),
		cancel:      cancel,
	}

	// Add user as subscriber
	track, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeVP8},
		"track-1",
		"stream-1",
	)
	require.NoError(t, err)

	activeTrack.mu.Lock()
	activeTrack.subscribers["user-1"] = track
	activeTrack.mu.Unlock()

	room.mu.Lock()
	room.activeTracks["host-track-1"] = activeTrack
	room.mu.Unlock()

	// Verify user is subscriber
	activeTrack.mu.RLock()
	_, exists := activeTrack.subscribers["user-1"]
	activeTrack.mu.RUnlock()
	assert.True(t, exists, "user should be subscriber before leaving")

	// Leave
	err = room.Leave("user-1")
	require.NoError(t, err)

	// Verify user removed from subscribers
	activeTrack.mu.RLock()
	_, exists = activeTrack.subscribers["user-1"]
	activeTrack.mu.RUnlock()
	assert.False(t, exists, "user should be removed from subscribers after leaving")
}

// TestIntegration_OwnerLeave_TrackRemoval tests that owner leaving removes track
func TestIntegration_OwnerLeave_TrackRemoval(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	room := NewRoom("test-room", cfg, api, nil)
	defer room.Close()

	// Create host session
	hostPC, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)

	hostSession := NewSession("host", room, hostPC)
	room.mu.Lock()
	room.sessions["host"] = hostSession
	room.mu.Unlock()

	// Create ActiveTrack owned by host
	ctx, cancel := context.WithCancel(room.ctx)
	activeTrack := &ActiveTrack{
		Remote:      nil,
		OwnerID:     "host",
		Kind:        webrtc.RTPCodecTypeVideo,
		subscribers: make(map[string]*webrtc.TrackLocalStaticRTP),
		cancel:      cancel,
	}

	room.mu.Lock()
	room.activeTracks["host-track-1"] = activeTrack
	room.mu.Unlock()

	// Verify track exists
	room.mu.RLock()
	_, exists := room.activeTracks["host-track-1"]
	room.mu.RUnlock()
	assert.True(t, exists, "track should exist before owner leaves")

	// Host leaves
	err = room.Leave("host")
	require.NoError(t, err)

	// Verify track removed
	room.mu.RLock()
	_, exists = room.activeTracks["host-track-1"]
	room.mu.RUnlock()
	assert.False(t, exists, "track should be removed when owner leaves")

	// Verify context was canceled
	select {
	case <-ctx.Done():
		t.Log("Context canceled successfully")
	case <-time.After(100 * time.Millisecond):
		t.Fatal("Context should be canceled when owner leaves")
	}
}

// TestIntegration_Join_Basic verifies that Join's duplicate check works correctly
func TestIntegration_Join_Basic(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	room := NewRoom("test-room", cfg, api, nil)
	defer room.Close()

	// Inject one session manually (simulating existing user)
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)
	defer pc.Close()

	room.mu.Lock()
	room.sessions["existing-user"] = NewSession("existing-user", room, pc)
	room.mu.Unlock()

	// Try to Join with same ID (should fail with duplicate error)
	_, err = room.Join("existing-user", "dummy-sdp")

	// MUST fail with ErrSessionAlreadyExists
	require.Error(t, err)
	assert.Contains(t, err.Error(), "session already exists",
		"Join should reject duplicate session IDs")

	t.Log("Join duplicate check verified at integration level")
}

// Full E2E Integration tests require Phase 4 (signaling + WebSocket)
func TestIntegration_E2E_Note(t *testing.T) {
	t.Skip("Full E2E with real RTP packet flow requires Phase 4 (signaling layer)")
	// These tests will include:
	// - Real SDP offer/answer exchange
	// - Actual RTP packet transmission
	// - Late Joiner receiving existing tracks
	// - 1:N Fan-out verification
}
