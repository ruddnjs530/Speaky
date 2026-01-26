package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"speaky-media/internal/config"
	"speaky-media/internal/core"
	"speaky-media/internal/server"
	"speaky-media/internal/upstream"
	"speaky-media/internal/webrtc"
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
		"port", cfg.Port,
	)

	// 4. Initialize Dependencies
	// WebRTC API
	api, err := webrtc.NewAPI(cfg)
	if err != nil {
		slog.Error("Failed to create WebRTC API", "error", err)
		os.Exit(1)
	}

	// AI Client (Upstream)
	aiClient, err := upstream.NewClient(ctx, cfg.AIServerAddr)
	if err != nil {
		// Log warning but continue? Or fail?
		// Requirement implies critical dependency. But maybe optional for dev?
		// Let's fail safe if strict, but warn if lax.
		// Given PROD, usually strict.
		slog.Error("Failed to connect to AI Server", "addr", cfg.AIServerAddr, "error", err)
		// os.Exit(1) // Optional: fail boot
	} else {
		defer aiClient.Close()
		slog.Info("Connected to AI Server", "addr", cfg.AIServerAddr)
	}

	// Room Manager
	roomManager := core.NewRoomManager(cfg, api, aiClient)

	// Signaling Server
	signaling := server.NewSignalingServer(roomManager)

	// HTTP Handler
	handler := server.NewHandler(signaling)
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	// 5. Start HTTP Server
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: mux,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
			os.Exit(1)
		}
	}()
	slog.Info("Server listening", "addr", srv.Addr)

	// 6. Wait for Shutdown
	<-ctx.Done()
	slog.Info("Shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
	}
	slog.Info("Server exited")
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
