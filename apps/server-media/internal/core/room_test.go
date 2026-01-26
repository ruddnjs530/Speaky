package core

import (
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

	room := NewRoom("test-room", cfg, api)

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

	room := NewRoom("test-room", cfg, api)

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

	room := NewRoom("test-room", cfg, api)

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
