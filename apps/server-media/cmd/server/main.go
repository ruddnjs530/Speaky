package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/media"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/upstream"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/webrtc"
)

func main() {
	// Configuration for the target AI server address.
	aiServerAddr := os.Getenv("AI_SERVER_ADDR")
	if aiServerAddr == "" {
		aiServerAddr = "localhost:50051"
	}

	log.Println("Starting Media Server...")

	// Initialize the gRPC sender as the output destination.
	grpcSender, err := upstream.NewGRPCSender(aiServerAddr)
	if err != nil {
		// Log a warning and proceed if the AI server is unavailable during testing.
		log.Printf("Warning: Failed to connect to AI server: %v", err)
		log.Println("Continuing for testing, but streaming will be disabled.")
	} else {
		defer grpcSender.Close()
		log.Println("Connected to AI Server")
	}

	// Initialize the media track for audio decoding and resampling.
	track, err := media.NewRegularTrack()
	if err != nil {
		log.Fatalf("Failed to create track: %v", err)
	}

	// Initialize the WebRTC receiver for incoming audio streams.
	receiver := webrtc.NewReceiver()

	// Connect the media pipeline components.

	// Bind WebRTC input to the processing track.
	receiver.OnAudioPacket(func(packet []byte) {
		// Log errors but continue to maintain real-time performance.
		if err := track.WriteOpus(packet); err != nil {
			log.Printf("Track write error: %v", err)
		}
	})

	// Bind the processing track to the gRPC output.
	// The pump runs in a separate goroutine to push data to the AI server.
	if grpcSender != nil {
		go upstream.StartPipelinePump(track, grpcSender)
	}

	log.Println("Audio Pipeline Assembled: [WebRTC Input] -> [Track Process] -> [gRPC Output]")

	// Wait for termination signals.
	// A signaling server should be implemented here to handle SDP negotiation.
	log.Println("Server is ready. Waiting for signals...")

	// Block until an interrupt or termination signal is received.
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs

	fmt.Println("\nShutting down server...")
}
