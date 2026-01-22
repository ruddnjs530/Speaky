package media

import "errors"

var (
	// ErrRoomNotFound is returned when a requested room ID does not exist in the registry.
	ErrRoomNotFound = errors.New("room not found")

	// ErrRoomIDCollision is returned when attempting to create a room with an ID that already exists.
	ErrRoomIDCollision = errors.New("room ID collision")
)
