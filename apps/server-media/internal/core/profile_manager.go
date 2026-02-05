package core

import (
	"fmt"
	"sync"
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
// Uses UUID for ID generation (simulated here for simplicity or passed in).
// For now, we will generate a simple ID or expect one. 
// Let's assume the caller might want to control the ID, or we generate one.
// To keep it simple and consistent with the plan, we'll generate one if not provided,
// but the plan implied the server generates it.
func (pm *ProfileManager) CreateProfile(voiceModelID int64, pitchScale float32) *VoiceProfile {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	// Simple ID generation
	id := fmt.Sprintf("profile-%d-%d", voiceModelID, len(pm.profiles)+1)
	
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
