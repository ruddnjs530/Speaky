package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/app"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
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

	// 4. Initialize and Run Application
	application, err := app.New(ctx, cfg)
	if err != nil {
		slog.Error("Failed to initialize application", "error", err)
		os.Exit(1)
	}

	if err := application.Run(ctx); err != nil {
		slog.Error("Application exited with error", "error", err)
		os.Exit(1)
	}
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
