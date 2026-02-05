package core

import (
	"fmt"
	"log/slog"
	"sync"

	"speaky-media/internal/config"

	"github.com/pion/webrtc/v4"

	"speaky-media/internal/ai"
	"speaky-media/internal/upstream"
)

// Manager manages rooms and their lifecycle.
type Manager struct {
	rooms          map[string]*Room
	mu             sync.RWMutex
	cfg            *config.Config
	api            *webrtc.API
	aiClient       ai.Client
	voiceProcessor upstream.VoiceProcessor
	profileManager *ProfileManager // Profile Manager
}

// NewRoomManager creates a new Manager.
func NewRoomManager(cfg *config.Config, api *webrtc.API, aiClient ai.Client, voiceProcessor upstream.VoiceProcessor) *Manager {
	return &Manager{
		rooms:          make(map[string]*Room),
		cfg:            cfg,
		api:            api,
		aiClient:       aiClient,
		voiceProcessor: voiceProcessor,
		profileManager: NewProfileManager(),
	}
}

// CreateProfile creates a voice profile and returns it.
func (m *Manager) CreateProfile(voiceModelID int64, pitchScale float32) *VoiceProfile {
	return m.profileManager.CreateProfile(voiceModelID, pitchScale)
}

// CreateRoom creates a new room with the given ID.
// Returns ErrRoomAlreadyExists if a room with this ID already exists.
func (m *Manager) CreateRoom(roomID, hostID, profileID string) (*Room, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.rooms[roomID]; exists {
		return nil, fmt.Errorf("%w: %s", ErrRoomAlreadyExists, roomID)
	}

	// Resolve Profile
	var profile *VoiceProfile
	if profileID != "" {
		p, err := m.profileManager.GetProfile(profileID)
		if err != nil {
			slog.Warn("CreateRoom: Profile not found, using default", "profileID", profileID)
		} else {
			profile = p
		}
	}

	room := NewRoom(roomID, hostID, profile, m.cfg, m.api, m.aiClient, m.voiceProcessor)
	// Auto-destruction when empty
	room.OnEmpty = func() {
		slog.Info("Room empty, destroying", "roomID", roomID)
		_ = m.DeleteRoom(roomID)
	}
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

	if room, exists := m.rooms[roomID]; exists {
		// Cleanup Profile if it exists
		if room.VoiceProfile != nil {
			m.profileManager.DeleteProfile(room.VoiceProfile.ID)
			slog.Info("Deleted associated voice profile", "profileID", room.VoiceProfile.ID)
		}

		room.Close() // Ensure resources are freed
		delete(m.rooms, roomID)
	} else {
		return fmt.Errorf("%w: %s", ErrRoomNotFound, roomID)
	}
	return nil
}

// GetOrCreateRoom retrieves a room if it exists, or creates it if it doesn't.
// This is a convenience method for common use cases.
func (m *Manager) GetOrCreateRoom(roomID, hostID, profileID string) (*Room, error) {
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

	// Resolve Profile
	var profile *VoiceProfile
	if profileID != "" {
		p, err := m.profileManager.GetProfile(profileID)
		if err != nil {
			slog.Warn("GetOrCreateRoom: Profile not found, using default", "profileID", profileID)
		} else {
			profile = p
		}
	}

	room = NewRoom(roomID, hostID, profile, m.cfg, m.api, m.aiClient, m.voiceProcessor)
	// Auto-destruction when empty
	room.OnEmpty = func() {
		slog.Info("Room empty, destroying", "roomID", roomID)
		_ = m.DeleteRoom(roomID)
	}
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

// Renegotiate handles a renegotiation request (subsequent SDP offer)
func (m *Manager) Renegotiate(roomID, userID, offerSDP string) (string, error) {
	room, err := m.GetRoom(roomID)
	if err != nil {
		return "", err
	}

	return room.Renegotiate(userID, offerSDP)
}

// Leave delegates to Room.Leave.
func (m *Manager) Leave(roomID, userID string) error {
	room, err := m.GetRoom(roomID)
	if err != nil {
		return err
	}
	return room.Leave(userID)
}

// Close shuts down the manager and all active rooms.
func (m *Manager) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()

	slog.Info("Shutting down Room Manager", "rooms", len(m.rooms))
	for id, room := range m.rooms {
		if err := room.Close(); err != nil {
			slog.Warn("Failed to close room", "roomID", id, "error", err)
		}
	}
	// Clear map
	m.rooms = make(map[string]*Room)
}
