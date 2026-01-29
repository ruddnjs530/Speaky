package main

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"

	"speaky-media/internal/ai"
	"speaky-media/internal/config"
	"speaky-media/internal/core"
	impl "speaky-media/internal/grpc"
	"speaky-media/internal/upstream"

	"time"

	"github.com/pion/webrtc/v4"
	"google.golang.org/grpc"

	pb "mediaserver/proto"
)

func main() {
	// 1. Setup Logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))
	slog.SetDefault(logger)

	// 2. Load Config
	// 2. Load Config
	cfg, err := config.Load()
	if err != nil {
		slog.Error("Failed to load config", "error", err)
		os.Exit(1)
	}
	port := cfg.Port

	// 3. Setup Dependencies
	// AI Client (Mock for Phase 4)
	aiClient := ai.NewMockClient()

	// WebRTC API (Standard settings)
	settingEngine := webrtc.SettingEngine{}
	// For Docker/NAT traversal, usually strictly host networking or specific Public IP config is needed.
	// For E2E local verification (host network), default is fine.
	api := webrtc.NewAPI(webrtc.WithSettingEngine(settingEngine))

	// Room Manager with AudioProcessor enabled (Real AI Client)
	aiAddr := os.Getenv("AI_SERVER_ADDR")
	if aiAddr == "" {
		aiAddr = "localhost:50051"
	}
	slog.Info("Connecting to AI Server", "addr", aiAddr)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	voiceProcessor, err := upstream.NewClient(ctx, aiAddr)
	if err != nil {
		slog.Error("Failed to connect to AI Server", "error", err)
		// Fallback to Mock if connection fails? Or fail hard?
		// For now, let's log and exit to ensure we know it failed.
		os.Exit(1)
	}

	manager := core.NewRoomManager(cfg, api, aiClient, voiceProcessor)

	// 4. Setup gRPC Server
	lis, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%s", port))
	if err != nil {
		slog.Error("Failed to listen", "error", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer()
	mediaService := impl.NewServer(manager)

	// Register Proto Service
	pb.RegisterControlServiceServer(grpcServer, mediaService)

	// 5. Start Server (Blocking)
	go func() {
		slog.Info("Starting gRPC Server", "port", port)
		if err := grpcServer.Serve(lis); err != nil {
			slog.Error("gRPC Server failed", "error", err)
			os.Exit(1)
		}
	}()

	// 6. Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down server...")
	grpcServer.GracefulStop()

	// Clean up Manager resources (Close all rooms/sessions)
	manager.Close()
	slog.Info("Server stopped")
}
