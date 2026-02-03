package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config holds all configuration for the server.
type Config struct {
	// General
	GoEnv    string // "local" or "prod"
	LogLevel string // "DEBUG", "INFO", "WARN", "ERROR"
	Port     string // HTTP/gRPC server port (e.g., "8080")

	// AI Server (Upstream)
	AIServerAddr string // gRPC address for AI Server (e.g., "localhost:50051")

	// WebRTC Network
	WebRTCMinPort uint16 // UDP Min Port (e.g., 50000)
	WebRTCMaxPort uint16 // UDP Max Port (e.g., 50050)
	PublicIP      string // Server Public IP for ICE Candidates (CRITICAL for NAT traversal)

	// WebRTC ICE Servers
	STUNServer     string
	TURNServer     string
	TURNUsername   string
	TURNCredential string

	// Audio Processing (AI Sync & Transcoding)
	// AudioSampleRate is the target sample rate required by the AI Server (e.g., 24000).
	// WebRTC input (48000Hz) will be resampled to this rate.
	AudioSampleRate    int
	AudioChannels      int // Target Channels (default: 1)
	PCMBufferSize      int // Internal buffer size for PCM channel (default: 100)
	AudioFrameDuration int // Audio Frame Duration in ms (default: 20)
	AIBufferDuration   int // Duration to buffer before sending to AI (default: 400ms)
}

// Load reads configuration from environment variables and validates them.
func Load() (*Config, error) {
	cfg := &Config{
		// General
		GoEnv:    getEnv("GO_ENV", "local"),
		LogLevel: getEnv("LOG_LEVEL", "INFO"),
		Port:     getEnv("PORT", "8090"),  // Changed from 8081 to 8090

		// AI Server
		AIServerAddr: getEnv("AI_SERVER_ADDR", "localhost:50051"),

		// WebRTC Network
		WebRTCMinPort: uint16(getEnvAsInt("WEBRTC_MIN_PORT", 50000)),
		WebRTCMaxPort: uint16(getEnvAsInt("WEBRTC_MAX_PORT", 50050)),
		PublicIP:      getEnv("PUBLIC_IP", ""),

		// ICE Servers
		STUNServer:     getEnv("STUN_SERVER", "stun:stun.l.google.com:19302"),
		TURNServer:     getEnv("TURN_SERVER", ""),
		TURNUsername:   getEnv("TURN_USERNAME", ""),
		TURNCredential: getEnv("TURN_CREDENTIAL", ""),

		// Audio
		AudioSampleRate:    getEnvAsInt("AUDIO_SAMPLE_RATE", 48000),
		AudioChannels:      getEnvAsInt("AUDIO_CHANNELS", 1),
		PCMBufferSize:      getEnvAsInt("PCM_BUFFER_SIZE", 100),
		AudioFrameDuration: getEnvAsInt("AUDIO_FRAME_DURATION", 20),
		AIBufferDuration:   getEnvAsInt("AI_BUFFER_DURATION", 400),
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Validate checks if the configuration is valid.
func (c *Config) Validate() error {
	if c.AIServerAddr == "" {
		return errors.New("AI_SERVER_ADDR is required")
	}

	// Port validation
	if c.Port != "" {
		p, err := strconv.Atoi(c.Port)
		if err != nil || p < 1 || p > 65535 {
			return fmt.Errorf("PORT must be a valid number between 1-65535, got: %s", c.Port)
		}
	}

	// WebRTC Port Range validation
	if c.WebRTCMinPort >= c.WebRTCMaxPort {
		return fmt.Errorf("WEBRTC_MIN_PORT (%d) must be less than WEBRTC_MAX_PORT (%d)", c.WebRTCMinPort, c.WebRTCMaxPort)
	}

	// Public IP validation
	if c.PublicIP == "" {
		if c.IsProd() {
			return errors.New("PUBLIC_IP is strictly required in production environment")
		}
		// In local, we can warn but proceed
		fmt.Println("⚠️ WARNING: PUBLIC_IP is not set. WebRTC connection might fail if client is not on localhost.")
	}

	// Audio validation
	if c.AudioSampleRate != 24000 && c.AudioSampleRate != 48000 {
		return fmt.Errorf("AUDIO_SAMPLE_RATE must be 24000 or 48000, got: %d", c.AudioSampleRate)
	}
	if c.AudioFrameDuration <= 0 {
		return errors.New("AUDIO_FRAME_DURATION must be positive")
	}

	return nil
}

// Helper functions

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	valueStr := getEnv(key, "")
	if valueStr == "" {
		return fallback
	}
	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return fallback
	}
	return value
}

// IsProd returns true if running in production environment.
func (c *Config) IsProd() bool {
	return strings.ToLower(c.GoEnv) == "prod"
}

// IsLocal returns true if running in local environment.
func (c *Config) IsLocal() bool {
	return strings.ToLower(c.GoEnv) == "local"
}
