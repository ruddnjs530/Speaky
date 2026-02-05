package core

import (
	"fmt"
	"sync"
    "github.com/google/uuid"
)

// VoiceProfile represents a configured voice profile.
type VoiceProfile struct {
	ID           string
	VoiceModelID int64
	PitchScale   float32
}

// ProfileManager manages voice profiles.
type ProfileManager struct {
	profiles map[string]*VoiceProfile
	mu       sync.RWMutex
}

// NewProfileManager creates a new ProfileManager.
func NewProfileManager() *ProfileManager {
	return &ProfileManager{
		profiles: make(map[string]*VoiceProfile),
	}
}

// CreateProfile stores a new voice profile and returns it.
func (pm *ProfileManager) CreateProfile(voiceModelID int64, pitchScale float32) *VoiceProfile {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	// Generate UUID
	id := uuid.New().String()
	
	profile := &VoiceProfile{
		ID:           id,
		VoiceModelID: voiceModelID,
		PitchScale:   pitchScale,
	}

	pm.profiles[id] = profile
	return profile
}

// GetProfile retrieves a profile by ID.
func (pm *ProfileManager) GetProfile(id string) (*VoiceProfile, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	profile, exists := pm.profiles[id]
	if !exists {
		return nil, fmt.Errorf("profile not found: %s", id)
	}
	return profile, nil
}

// DeleteProfile removes a profile by ID.
func (pm *ProfileManager) DeleteProfile(id string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	delete(pm.profiles, id)
}
