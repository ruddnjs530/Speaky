package main

import (
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/pion/webrtc/v4"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/media"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/upstream"
	mediaWebrtc "lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/webrtc"
)

func main() {
	// 1. Load Configuration
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		panic(fmt.Sprintf("Invalid configuration: %v", err))
	}

	// 2. Initialize Logger (slog)
	initLogger(cfg)

	slog.Info("Starting Media Server...",
		"env", cfg.Env,
		"ai_server", cfg.AIServerAddr,
		"log_level", cfg.LogLevel,
	)

	// Initialize the gRPC sender as the output destination.
	grpcSender, err := upstream.NewGRPCSender(cfg.AIServerAddr)
	if err != nil {
		// Log a warning and proceed if the AI server is unavailable during testing.
		slog.Warn("Failed to connect to AI server", "error", err)
		slog.Info("Continuing for testing, but streaming will be disabled.")
	} else {
		defer grpcSender.Close()
		slog.Info("Connected to AI Server")
	}

	// Initialize the media track for audio decoding and resampling.
	track, err := media.NewRegularTrack()
	if err != nil {
		slog.Error("Failed to create track", "error", err)
		os.Exit(1)
	}

	// Initialize WebRTC API with Global Config (Port Range)
	settingEngine := webrtc.SettingEngine{}
	if err := settingEngine.SetEphemeralUDPPortRange(cfg.WebRTCMinPort, cfg.WebRTCMaxPort); err != nil {
		slog.Error("Failed to set UDP port range", "error", err)
		os.Exit(1)
	}
	api := webrtc.NewAPI(webrtc.WithSettingEngine(settingEngine))

	// Initialize the WebRTC receiver for incoming audio streams.
	// Inject API and Config
	receiver := mediaWebrtc.NewReceiver(api, cfg)

	// Connect the media pipeline components.

	// Bind WebRTC input to the processing track.
	receiver.OnAudioPacket(func(packet []byte) {
		// Log errors but continue to maintain real-time performance.
		if err := track.WriteOpus(packet); err != nil {
			slog.Error("Track write error", "error", err)
		}
	})

	// Bind the processing track to the gRPC output.
	// The pump runs in a separate goroutine to push data to the AI server.
	if grpcSender != nil {
		go upstream.StartPipelinePump(track, grpcSender)
	}

	slog.Info("Audio Pipeline Assembled", "pipeline", "[WebRTC Input] -> [Track Process] -> [gRPC Output]")

	// Wait for termination signals.
	// A signaling server should be implemented here to handle SDP negotiation.
	slog.Info("Server is ready. Waiting for signals...")

	// Block until an interrupt or termination signal is received.
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigs

	slog.Info("Shutting down server...", "signal", sig)
}

func initLogger(cfg *config.Config) {
	// Parse LOG_LEVEL
	var level slog.Level
	switch strings.ToUpper(cfg.LogLevel) {
	case "DEBUG":
		level = slog.LevelDebug
	case "WARN":
		level = slog.LevelWarn
	case "ERROR":
		level = slog.LevelError
	default:
		level = slog.LevelInfo // Default
	}

	// Helper to create options
	opts := &slog.HandlerOptions{
		Level: level,
	}

	// Determine Handler based on GO_ENV
	var handler slog.Handler

	if strings.ToLower(cfg.Env) == "prod" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		// Default to local/text for readability
		handler = slog.NewTextHandler(os.Stdout, opts)
	}

	// Set Default Logger
	logger := slog.New(handler)
	slog.SetDefault(logger)
}
