package media_test

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/media"
)

// setupManager creates a RoomManager with a basic test configuration.
func setupManager(t *testing.T) *media.RoomManager {
	cfg := &config.Config{
		WebRTCMinPort: 60000,
		WebRTCMaxPort: 60050,
	}
	manager, err := media.NewRoomManager(cfg)
	require.NoError(t, err, "Failed to create RoomManager")
	return manager
}

func TestRoomManager_CreateRoom(t *testing.T) {
	manager := setupManager(t)

	room, err := manager.CreateRoom("host-123")
	require.NoError(t, err)
	assert.NotEmpty(t, room.ID, "Room ID should not be empty")

	retrievedRoom, err := manager.GetRoom(room.ID)
	require.NoError(t, err)

	// Compare IDs instead of pointers (more robust for future changes)
	assert.Equal(t, room.ID, retrievedRoom.ID)
}

func TestRoomManager_GetRoom_NotFound(t *testing.T) {
	manager := setupManager(t)

	room, err := manager.GetRoom("non-existent-id")
	// Use Sentinel Error Check
	assert.ErrorIs(t, err, media.ErrRoomNotFound)
	assert.Nil(t, room)
}

func TestRoomManager_DeleteRoom(t *testing.T) {
	manager := setupManager(t)
	room, _ := manager.CreateRoom("host-1")

	// Verify existence
	assert.Equal(t, 1, manager.RoomCount())

	// Delete existing room
	err := manager.DeleteRoom(room.ID)
	require.NoError(t, err)

	// Verify removal count
	assert.Equal(t, 0, manager.RoomCount())

	// Verify retrieval fails
	_, err = manager.GetRoom(room.ID)
	assert.ErrorIs(t, err, media.ErrRoomNotFound)

	// Verify double delete fails with correct error
	err = manager.DeleteRoom(room.ID)
	assert.ErrorIs(t, err, media.ErrRoomNotFound)
}

func TestRoomManager_Concurrency(t *testing.T) {
	manager := setupManager(t)
	var wg sync.WaitGroup
	roomCount := 100

	// Concurrent Create
	for i := 0; i < roomCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := manager.CreateRoom("host-concurrent")
			assert.NoError(t, err)
		}()
	}
	wg.Wait()

	// Verify data integrity: We MUST have exactly 100 rooms
	assert.Equal(t, roomCount, manager.RoomCount(), "Room count mismatch after concurrent creation")

	// Concurrent Delete
	// Create a list of IDs first to avoid race in traversing map while deleting in test logic
	// (Though Manager.CloseAll or Delete is thread safe provided we pass ID)
	// We can't easily iterate the map keys outside lock, but we don't have GetRooms() yet.
	// Since we didn't save IDs in the creation loop (to keep it clean), we'll trust CloseAll here
	// or we can modify the creation loop to save them.
	// Let's rely on CloseAll for batch cleanup testing or verify Manager.RoomCount() handles concurrent Deletes if we knew the IDs.

	// Let's do a strict concurrent delete test with known IDs.
	// Reset manager for strict delete test
	manager = setupManager(t)
	ids := make([]string, roomCount)
	for i := 0; i < roomCount; i++ {
		r, _ := manager.CreateRoom("h")
		ids[i] = r.ID
	}

	// Delete all concurrently
	for _, id := range ids {
		wg.Add(1)
		go func(roomID string) {
			defer wg.Done()
			err := manager.DeleteRoom(roomID)
			assert.NoError(t, err)
		}(id)
	}
	wg.Wait()

	assert.Equal(t, 0, manager.RoomCount(), "Room count mismatch after concurrent deletion")
}

func TestRoom_ContextCleanup(t *testing.T) {
	manager := setupManager(t)
	room, _ := manager.CreateRoom("host-c")

	// Capture the done channel BEFORE deletion
	doneCh := room.Context().Done()

	// Delete
	err := manager.DeleteRoom(room.ID)
	require.NoError(t, err)

	// Verify context is actually cancelled
	select {
	case <-doneCh:
		// Success
	case <-time.After(100 * time.Millisecond):
		t.Fatal("Room context was not cancelled within timeout")
	}
}
