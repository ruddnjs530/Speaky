package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

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

	// 3. Create Root Context for Graceful Shutdown
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	slog.Info("Starting Media Server...",
		"env", cfg.Env,
		"ai_server", cfg.AIServerAddr,
		"log_level", cfg.LogLevel,
	)

	// Initialize the gRPC sender as the output destination.
	// Pass ctx for stream management.
	grpcSender, err := upstream.NewGRPCSender(ctx, cfg.AIServerAddr)
	if err != nil {
		// Log a warning and proceed if the AI server is unavailable during testing.
		slog.Warn("Failed to connect to AI server", "error", err)
		slog.Info("Continuing for testing, but streaming will be disabled.")
	} else {
		// Ensure gRPC connection is closed on shutdown
		defer func() {
			slog.Info("Closing gRPC sender...")
			if err := grpcSender.Close(); err != nil {
				slog.Error("Failed to close gRPC sender", "error", err)
			}
		}()
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
		go upstream.StartPipelinePump(ctx, track, grpcSender)
	}

	slog.Info("Audio Pipeline Assembled", "pipeline", "[WebRTC Input] -> [Track Process] -> [gRPC Output]")
	slog.Info("Server is ready. Waiting for signals...")

	// Block until context is cancelled (signal received)
	<-ctx.Done()

	slog.Info("Shutdown signal received. Cleaning up...")

	// Shutdown Grace Period
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Close Receiver (WebRTC)
	if err := receiver.Close(); err != nil {
		slog.Error("Failed to close receiver", "error", err)
	} else {
		slog.Info("WebRTC Receiver closed")
	}

	// Wait for shutdown timeout or finish
	<-shutdownCtx.Done()
	slog.Info("Server exited.")
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
