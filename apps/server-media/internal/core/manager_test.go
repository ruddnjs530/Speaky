package core

import (
	"errors"
	"testing"

	"speaky-media/internal/config"

	"github.com/pion/webrtc/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestManager_CreateRoom tests room creation
func TestManager_CreateRoom(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	manager := NewRoomManager(cfg, api, nil, nil)

	// Create room
	room, err := manager.CreateRoom("test-room")
	require.NoError(t, err)
	assert.NotNil(t, room)
	assert.Equal(t, "test-room", room.ID)
}

// TestManager_CreateRoom_Duplicate tests duplicate room creation
func TestManager_CreateRoom_Duplicate(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	manager := NewRoomManager(cfg, api, nil, nil)

	// Create first room
	_, err := manager.CreateRoom("test-room")
	require.NoError(t, err)

	// Try to create duplicate
	_, err = manager.CreateRoom("test-room")
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrRoomAlreadyExists))
}

// TestManager_GetRoom tests retrieving existing room
func TestManager_GetRoom(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	manager := NewRoomManager(cfg, api, nil, nil)

	// Create room
	created, err := manager.CreateRoom("test-room")
	require.NoError(t, err)

	// Get room
	retrieved, err := manager.GetRoom("test-room")
	require.NoError(t, err)
	assert.Equal(t, created, retrieved)
}

// TestManager_GetRoom_NotFound tests getting non-existent room
func TestManager_GetRoom_NotFound(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	manager := NewRoomManager(cfg, api, nil, nil)

	// Try to get non-existent room
	_, err := manager.GetRoom("non-existent")
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrRoomNotFound))
}

// TestManager_DeleteRoom tests room deletion
func TestManager_DeleteRoom(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	manager := NewRoomManager(cfg, api, nil, nil)

	// Create and delete room
	_, err := manager.CreateRoom("test-room")
	require.NoError(t, err)

	err = manager.DeleteRoom("test-room")
	require.NoError(t, err)

	// Verify room is gone
	_, err = manager.GetRoom("test-room")
	assert.True(t, errors.Is(err, ErrRoomNotFound))
}

// TestManager_GetOrCreateRoom tests the convenience method
func TestManager_GetOrCreateRoom(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	manager := NewRoomManager(cfg, api, nil, nil)

	// First call should create
	room1, err := manager.GetOrCreateRoom("test-room")
	require.NoError(t, err)
	assert.NotNil(t, room1)

	// Second call should return existing
	room2, err := manager.GetOrCreateRoom("test-room")
	require.NoError(t, err)
	assert.Equal(t, room1, room2)
}

// TestManager_Concurrent tests concurrent access
func TestManager_Concurrent(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	manager := NewRoomManager(cfg, api, nil, nil)

	const numGoroutines = 100
	done := make(chan bool, numGoroutines)

	// Spawn goroutines that create/get/delete rooms
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer func() { done <- true }()

			roomID := "room-0" // All goroutines compete for same room

			// Try to create or get
			_, _ = manager.GetOrCreateRoom(roomID)

			// Try to get
			_, _ = manager.GetRoom(roomID)
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < numGoroutines; i++ {
		<-done
	}

	// Verify room exists
	room, err := manager.GetRoom("room-0")
	require.NoError(t, err)
	assert.NotNil(t, room)
}
