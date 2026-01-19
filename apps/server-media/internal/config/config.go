package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config holds all application configuration.
type Config struct {
	Env          string // local, prod
	LogLevel     string // DEBUG, INFO, WARN, ERROR
	Port         string // HTTP/gRPC server port (e.g. "8080")
	AIServerAddr string // AI server address (e.g. "localhost:50051")

	// WebRTC UDP Port Range
	WebRTCMinPort uint16
	WebRTCMaxPort uint16

	// WebRTC ICE Servers
	STUNServer     string
	TURNServer     string
	TURNUsername   string
	TURNCredential string
}

// Load reads configuration from environment variables with default fallback.
func Load() *Config {
	return &Config{
		Env:            getEnv("GO_ENV", "local"),
		LogLevel:       getEnv("LOG_LEVEL", "INFO"),
		Port:           getEnv("PORT", "8080"),
		AIServerAddr:   getEnv("AI_SERVER_ADDR", "localhost:50051"),
		WebRTCMinPort:  getEnvAsUint16("WEBRTC_MIN_PORT", 50000),
		WebRTCMaxPort:  getEnvAsUint16("WEBRTC_MAX_PORT", 50010),
		STUNServer:     getEnv("STUN_SERVER", "stun:stun.l.google.com:19302"),
		TURNServer:     getEnv("TURN_SERVER", ""),
		TURNUsername:   getEnv("TURN_USERNAME", ""),
		TURNCredential: getEnv("TURN_CREDENTIAL", ""),
	}
}

// Validate checks for configuration errors.
func (c *Config) Validate() error {
	if c.WebRTCMinPort >= c.WebRTCMaxPort {
		return fmt.Errorf("WebRTCMinPort (%d) must be less than WebRTCMaxPort (%d)", c.WebRTCMinPort, c.WebRTCMaxPort)
	}
	if c.AIServerAddr == "" {
		return fmt.Errorf("AIServerAddr cannot be empty")
	}
	return nil
}

// getEnv retrieves environment variable or returns default value.
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// getEnvAsUint16 retrieves environment variable as uint16 or returns default value.
func getEnvAsUint16(key string, fallback uint16) uint16 {
	if valueStr, exists := os.LookupEnv(key); exists {
		if value, err := strconv.ParseUint(valueStr, 10, 16); err == nil {
			return uint16(value)
		}
	}
	return fallback
}
