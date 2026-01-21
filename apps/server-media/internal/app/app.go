package app

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	pb "mediaserver/proto"

	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/control"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/media"
)

// App manages the lifecycle of the media server application.
type App struct {
	cfg         *config.Config
	roomManager *media.RoomManager
	grpcServer  *grpc.Server
}

// New creates a new App instance and initializes dependencies.
func New(ctx context.Context, cfg *config.Config) (*App, error) {
	app := &App{cfg: cfg}

	// 1. Initialize RoomManager (Singleton)
	// This will also initialize the shared WebRTC API.
	manager, err := media.NewRoomManager(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create room manager: %w", err)
	}
	app.roomManager = manager
	slog.Info("RoomManager initialized")

	// 2. Initialize gRPC Server
	// TODO: Add credentials for production.
	grpcServer := grpc.NewServer()
	app.grpcServer = grpcServer

	// 3. Register Control Service
	controlHandler := control.NewHandler(manager)
	pb.RegisterControlServiceServer(grpcServer, controlHandler)

	// Enable reflection for grpcurl debugging
	reflection.Register(grpcServer)
	slog.Info("ControlService registered")

	return app, nil
}

// Run starts the application and blocks until the context is cancelled.
func (a *App) Run(ctx context.Context) error {
	// 1. Listen on gRPC Port
	lis, err := net.Listen("tcp", fmt.Sprintf(":%s", a.cfg.Port))
	if err != nil {
		return fmt.Errorf("failed to listen on port %s: %w", a.cfg.Port, err)
	}

	// 2. Start gRPC Server in a goroutine
	errChan := make(chan error, 1)
	go func() {
		slog.Info("Starting gRPC Server", "port", a.cfg.Port)
		if err := a.grpcServer.Serve(lis); err != nil {
			errChan <- err
		}
	}()

	slog.Info("Server is ready. Waiting for signals...")

	// 3. Wait for Shutdown Signal or Server Error
	select {
	case <-ctx.Done():
		// Graceful shutdown triggered by signal or parent context
		return a.shutdown()
	case err := <-errChan:
		// Server crashed
		return fmt.Errorf("grpc server error: %w", err)
	}
}

// shutdown performs graceful cleanup.
func (a *App) shutdown() error {
	slog.Info("Shutdown signal received. Cleaning up...")

	// Create a timeout for cleanup
	// Note: We don't pass this ctx to GracefulStop because it doesn't take one,
	// but strictly speaking we should enforce a timeout.
	// grpcServer.GracefulStop() blocks until pending RPCs finish.
	done := make(chan struct{})
	go func() {
		a.grpcServer.GracefulStop()
		close(done)
	}()

	select {
	case <-done:
		slog.Info("gRPC Server stopped gracefully")
	case <-time.After(5 * time.Second):
		slog.Warn("Shutdown timed out, forcing stop")
		a.grpcServer.Stop()
	}

	// Clean up Rooms (and their participants)
	// Iterate through all rooms and close them.
	if a.roomManager != nil {
		a.roomManager.CloseAll()
		slog.Info("All rooms closed")
	}

	slog.Info("Server exited.")
	return nil
}
