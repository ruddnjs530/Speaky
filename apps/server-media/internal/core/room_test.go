package core

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"speaky-media/internal/config"

	"github.com/pion/webrtc/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRoom_New verifies that NewRoom correctly initializes a room
func TestRoom_New(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}

	room := NewRoom("test-room", cfg, api, nil, nil)

	// Verify room is created
	require.NotNil(t, room)
	assert.Equal(t, "test-room", room.ID)

	// Verify context is initialized
	require.NotNil(t, room.ctx, "context should be initialized")
	require.NotNil(t, room.cancel, "cancel function should be initialized")

	// Verify maps are initialized
	require.NotNil(t, room.sessions, "sessions map should be initialized")
	require.NotNil(t, room.activeTracks, "activeTracks map should be initialized")

	// Verify config and api are set
	assert.Equal(t, cfg, room.cfg)
	assert.Equal(t, api, room.api)
}

// TestRoom_Close verifies that Close properly cancels the context
func TestRoom_Close(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}

	room := NewRoom("test-room", cfg, api, nil, nil)

	// Verify context is not canceled initially
	select {
	case <-room.ctx.Done():
		t.Fatal("context should not be canceled before Close()")
	default:
		// Expected: context is still active
	}

	// Close the room
	err := room.Close()
	require.NoError(t, err, "Close should not return an error")

	// Verify context is canceled
	select {
	case <-room.ctx.Done():
		// Expected: context is canceled
	case <-time.After(100 * time.Millisecond):
		t.Fatal("context should be canceled after Close()")
	}

	// Verify context error
	assert.Error(t, room.ctx.Err(), "context should have an error after cancellation")
	assert.Equal(t, "context canceled", room.ctx.Err().Error())
}

// TestRoom_Close_Idempotent verifies that calling Close multiple times is safe
func TestRoom_Close_Idempotent(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}

	room := NewRoom("test-room", cfg, api, nil, nil)

	// Close multiple times
	err1 := room.Close()
	err2 := room.Close()
	err3 := room.Close()

	// All should succeed
	require.NoError(t, err1)
	require.NoError(t, err2)
	require.NoError(t, err3)

	// Context should still be canceled
	select {
	case <-room.ctx.Done():
		// Expected
	default:
		t.Fatal("context should remain canceled")
	}
}

// TestRoom_Join_SingleUser tests basic join functionality
func TestRoom_Join_SingleUser(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	room := NewRoom("test-room", cfg, api, nil, nil)
	defer room.Close()

	// Note: Real SDP exchange requires complex setup
	// This test verifies the method structure only
	t.Skip("Join requires real PeerConnection setup; tested in integration tests")
}

// TestRoom_Join_Duplicate tests duplicate join prevention
func TestRoom_Join_Duplicate(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	room := NewRoom("test-room", cfg, api, nil, nil)
	defer room.Close()

	// Manually add a session to simulate existing user
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)
	defer pc.Close()

	session := NewSession("user-1", room, pc, nil)
	room.mu.Lock()
	room.sessions["user-1"] = session
	room.mu.Unlock()

	// Try to join with same user ID
	_, err = room.Join("user-1", "fake-sdp")
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrSessionAlreadyExists))
}

// TestRoom_Leave tests removing a participant
func TestRoom_Leave(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	room := NewRoom("test-room", cfg, api, nil, nil)
	defer room.Close()

	// Manually add a session
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)

	session := NewSession("user-1", room, pc, nil)
	room.mu.Lock()
	room.sessions["user-1"] = session
	room.mu.Unlock()

	// Leave
	err = room.Leave("user-1")
	require.NoError(t, err)

	// Verify session removed
	room.mu.RLock()
	_, exists := room.sessions["user-1"]
	room.mu.RUnlock()
	assert.False(t, exists, "session should be removed")
}

// TestRoom_Leave_NotFound tests leaving non-existent session
func TestRoom_Leave_NotFound(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	room := NewRoom("test-room", cfg, api, nil, nil)
	defer room.Close()

	err := room.Leave("non-existent")
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrSessionNotFound))
}

// TestRoom_Concurrency tests concurrent Join/Leave operations
func TestRoom_Concurrency(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	room := NewRoom("test-room", cfg, api, nil, nil)
	defer room.Close()

	const numGoroutines = 100
	done := make(chan bool, numGoroutines)

	// Spawn goroutines that add/remove sessions
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer func() { done <- true }()

			userID := fmt.Sprintf("user-%d", id)

			// Create and manually add session
			pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
			if err != nil {
				return
			}
			defer pc.Close()

			session := NewSession(userID, room, pc, nil)

			// Add session
			room.mu.Lock()
			room.sessions[userID] = session
			room.mu.Unlock()

			// Leave
			_ = room.Leave(userID)
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < numGoroutines; i++ {
		<-done
	}

	// Verify room is empty
	room.mu.RLock()
	sessionCount := len(room.sessions)
	room.mu.RUnlock()

	assert.Equal(t, 0, sessionCount, "all sessions should be removed")
}
