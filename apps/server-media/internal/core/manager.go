package core

import (
	"fmt"
	"sync"

	"speaky-media/internal/config"

	"github.com/pion/webrtc/v4"

	"speaky-media/internal/ai"
)

// Manager is the global registry for all rooms.
// It manages room lifecycle and provides thread-safe access.
type Manager struct {
	rooms map[string]*Room
	mu    sync.RWMutex
	cfg      *config.Config
	api      *webrtc.API
	aiClient ai.Client
}

// NewRoomManager creates a new room manager.
func NewRoomManager(cfg *config.Config, api *webrtc.API, aiClient ai.Client) *Manager {
	return &Manager{
		rooms:    make(map[string]*Room),
		cfg:      cfg,
		api:      api,
		aiClient: aiClient,
	}
}

// CreateRoom creates a new room with the given ID.
// Returns ErrRoomAlreadyExists if a room with this ID already exists.
func (m *Manager) CreateRoom(roomID string) (*Room, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.rooms[roomID]; exists {
		return nil, fmt.Errorf("%w: %s", ErrRoomAlreadyExists, roomID)
	}

	room := NewRoom(roomID, m.cfg, m.api, m.aiClient)
	m.rooms[roomID] = room

	return room, nil
}

// GetRoom retrieves an existing room by ID.
// Returns ErrRoomNotFound if the room does not exist.
func (m *Manager) GetRoom(roomID string) (*Room, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	room, exists := m.rooms[roomID]
	if !exists {
		return nil, fmt.Errorf("%w: %s", ErrRoomNotFound, roomID)
	}

	return room, nil
}

// DeleteRoom removes a room from the registry.
// Returns ErrRoomNotFound if the room does not exist.
func (m *Manager) DeleteRoom(roomID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.rooms[roomID]; !exists {
		return fmt.Errorf("%w: %s", ErrRoomNotFound, roomID)
	}

	delete(m.rooms, roomID)
	return nil
}

// GetOrCreateRoom retrieves a room if it exists, or creates it if it doesn't.
// This is a convenience method for common use cases.
func (m *Manager) GetOrCreateRoom(roomID string) (*Room, error) {
	// Fast path: try to get existing room (read lock)
	m.mu.RLock()
	room, exists := m.rooms[roomID]
	m.mu.RUnlock()

	if exists {
		return room, nil
	}

	// Slow path: create new room (write lock)
	m.mu.Lock()
	defer m.mu.Unlock()

	// Double-check in case another goroutine created it
	if room, exists := m.rooms[roomID]; exists {
		return room, nil
	}

	room = NewRoom(roomID, m.cfg, m.api, m.aiClient)
	m.rooms[roomID] = room

	return room, nil
}
// Join delegates to Room.Join.
func (m *Manager) Join(roomID, userID, offerSDP string) (string, error) {
	room, err := m.GetRoom(roomID)
	if err != nil {
		return "", err
	}
	return room.Join(userID, offerSDP)
}

// Leave delegates to Room.Leave.
func (m *Manager) Leave(roomID, userID string) error {
	room, err := m.GetRoom(roomID)
	if err != nil {
		return err
	}
	return room.Leave(userID)
}
