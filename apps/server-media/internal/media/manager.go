package media

import (
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/pion/webrtc/v4"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
)

// RoomManager manages the lifecycle of rooms and provides access to shared resources.
type RoomManager struct {
	rooms map[string]*Room
	mu    sync.RWMutex

	cfg *config.Config
	api *webrtc.API // Shared WebRTC API instance
}

// NewRoomManager creates a new RoomManager with shared dependencies.
func NewRoomManager(cfg *config.Config) (*RoomManager, error) {
	// Initialize shared WebRTC API with configured port range
	settingEngine := webrtc.SettingEngine{}
	if err := settingEngine.SetEphemeralUDPPortRange(cfg.WebRTCMinPort, cfg.WebRTCMaxPort); err != nil {
		return nil, fmt.Errorf("failed to set UDP port range: %w", err)
	}
	
	// Prepare the API object
	// Note: We might need Interceptors here in the future.
	api := webrtc.NewAPI(webrtc.WithSettingEngine(settingEngine))

	return &RoomManager{
		rooms: make(map[string]*Room),
		cfg:   cfg,
		api:   api,
	}, nil
}

// CreateRoom creates a new room and registers it.
func (m *RoomManager) CreateRoom(hostID string) (*Room, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Generate unique Room ID
	roomID := uuid.New().String()

	room := NewRoom(roomID, m.cfg, m.api)
	m.rooms[roomID] = room

	return room, nil
}

// GetRoom retrieves a room by ID.
func (m *RoomManager) GetRoom(roomID string) (*Room, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	room, exists := m.rooms[roomID]
	if !exists {
		return nil, fmt.Errorf("room not found: %s", roomID)
	}
	return room, nil
}

// DeleteRoom closes a room and removes it from the registry.
func (m *RoomManager) DeleteRoom(roomID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, exists := m.rooms[roomID]
	if !exists {
		return fmt.Errorf("room not found: %s", roomID)
	}

	// Clean up room resources (cancels context, closes participants)
	room.Close()

	delete(m.rooms, roomID)
	return nil
}

// CloseAll closes all active rooms and releases resources.
func (m *RoomManager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, room := range m.rooms {
		room.Close()
		delete(m.rooms, id)
	}
}
