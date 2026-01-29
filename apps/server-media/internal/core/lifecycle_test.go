package core

import (
	"errors"
	"speaky-media/internal/config"
	"testing"

	"github.com/pion/webrtc/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLifecycle_AutoDestruction(t *testing.T) {
	cfg := &config.Config{}
	api := &webrtc.API{}
	manager := NewRoomManager(cfg, api, nil, nil)

	// 1. Create Room
	room, err := manager.CreateRoom("auto-destruct-room", "host-1")
	require.NoError(t, err)

	// 2. Join User (Simulate manually to avoid SDP complexity)
	pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)
	defer pc.Close()

	// We pass a nil callback here because we are calling room.Leave directly in step 3,
	// which triggers the room.OnEmpty callback that Manager set up.
	session := NewSession("user-1", "host", room, pc, nil)

	room.mu.Lock()
	room.sessions["user-1"] = session
	room.mu.Unlock()

	// Verify room exists
	retrieved, err := manager.GetRoom("auto-destruct-room")
	require.NoError(t, err)
	assert.Equal(t, room, retrieved)

	// 3. Leave User (trigger destruction logic)
	err = room.Leave("user-1")
	require.NoError(t, err)

	// 4. Verify Room is destroyed
	// Room.Leave check empty -> calls room.OnEmpty -> calls manager.DeleteRoom
	_, err = manager.GetRoom("auto-destruct-room")
	assert.Error(t, err)
	assert.True(t, errors.Is(err, ErrRoomNotFound), "Room should be deleted after last user leaves")
}
