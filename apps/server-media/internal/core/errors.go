package core

import "errors"

// Sentinel errors for core domain logic
var (
	// ErrRoomNotFound is returned when requesting a room that does not exist
	ErrRoomNotFound = errors.New("room not found")

	// ErrRoomAlreadyExists is returned when creating a room with an ID that is already in use
	ErrRoomAlreadyExists = errors.New("room already exists")

	// ErrSessionNotFound is returned when requesting a session that does not exist in the room
	ErrSessionNotFound = errors.New("session not found")

	// ErrSessionClosed is returned when attempting operations on a closed session
	ErrSessionClosed = errors.New("session closed")
)
