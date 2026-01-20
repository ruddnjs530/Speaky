package app

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"time"

	"github.com/pion/webrtc/v4"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/pipeline"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/upstream"
	mediaWebrtc "lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/webrtc"
)

// App manages the lifecycle of the media server application.
type App struct {
	cfg        *config.Config
	grpcSender *upstream.GRPCSender
	transcoder pipeline.Transcoder
	receiver   mediaWebrtc.Receiver
}

// New creates a new App instance and initializes dependencies.
func New(ctx context.Context, cfg *config.Config) (*App, error) {
	app := &App{cfg: cfg}

	// 1. Initialize gRPC Sender
	// Pass ctx for stream management (though ideally context is per-request/stream, not app-global for connection)
	sender, err := upstream.NewGRPCSender(ctx, cfg)
	if err != nil {
		slog.Warn("Failed to connect to AI server", "error", err)
		slog.Info("Continuing without upstream connection (streaming disabled)")
	} else {
		app.grpcSender = sender
		slog.Info("Connected to AI Server")
	}

	// 2. Initialize Media Pipeline (Transcoder)
	track, err := pipeline.NewOpusToPCMTranscoder(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create transcoder: %w", err)
	}
	app.transcoder = track

	// 3. Initialize WebRTC Receiver
	settingEngine := webrtc.SettingEngine{}
	if err := settingEngine.SetEphemeralUDPPortRange(cfg.WebRTCMinPort, cfg.WebRTCMaxPort); err != nil {
		return nil, fmt.Errorf("failed to set UDP port range: %w", err)
	}
	api := webrtc.NewAPI(webrtc.WithSettingEngine(settingEngine))
	app.receiver = mediaWebrtc.NewReceiver(api, cfg)

	return app, nil
}

// Run starts the application and blocks until the context is cancelled.
func (a *App) Run(ctx context.Context) error {
	// 1. Wire Components
	// Bind WebRTC input to Transcoder
	a.receiver.OnAudioPacket(func(packet []byte) {
		if err := a.transcoder.WriteOpus(packet); err != nil {
			slog.Error("Track write error", "error", err)
		}
	})

	// 2. Start Pump (Transcoder -> gRPC)
	if a.grpcSender != nil {
		go a.startPipelinePump(ctx)
	}

	slog.Info("Audio Pipeline Assembled", "pipeline", "[WebRTC Input] -> [Track Process] -> [gRPC Output]")
	slog.Info("Server is ready. Waiting for signals...")

	// 3. Wait for Shutdown
	<-ctx.Done()

	return a.shutdown()
}

// shutdown performs graceful cleanup.
func (a *App) shutdown() error {
	slog.Info("Shutdown signal received. Cleaning up...")

	// Create a timeout for cleanup
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Close WebRTC Receiver
	if err := a.receiver.Close(); err != nil {
		slog.Error("Failed to close receiver", "error", err)
	} else {
		slog.Info("WebRTC Receiver closed")
	}

	// Close gRPC Sender
	if a.grpcSender != nil {
		if err := a.grpcSender.Close(); err != nil {
			slog.Error("Failed to close gRPC sender", "error", err)
		} else {
			slog.Info("gRPC Sender closed")
		}
	}

	// Wait for context cancellation or timeout
	<-ctx.Done()
	slog.Info("Server exited.")
	return nil
}

// startPipelinePump reads PCM data from the track and sends it to the gRPC stream.
// Moved from internal/upstream to decouple packages.
func (a *App) startPipelinePump(ctx context.Context) {
	for {
		pcmData, err := a.transcoder.ReadPCM(ctx)
		if err != nil {
			if err == io.EOF || err == context.Canceled {
				return // Channel closed or context cancelled
			}
			// Log error via external logger if available, for now just return/stop
			return
		}

		// Send to gRPC stream
		if err := a.grpcSender.Send(pcmData); err != nil {
			return
		}
	}
}
