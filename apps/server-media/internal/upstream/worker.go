package upstream

import (
	"fmt"
	"log"

	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/media"
)

// StartPipelinePump connects the media track to the upstream sender.
// It reads processed PCM data from the track and pushes it to the sender in a loop.
// Note: This function blocks the caller, so it should be executed in a goroutine.
func StartPipelinePump(track media.Track, sender AudioSender) {
	defer sender.Close()

	fmt.Println("Pipeline Pump Started: Track -> gRPC")

	for {
		// Fetch processed 16kHz PCM audio from the track buffer.
		// This call blocks until audio data becomes available.
		pcmData, err := track.ReadPCM()
		if err != nil {
			log.Printf("Pipeline stopped: failed to read from track: %v\n", err)
			return
		}

		// Transmit the audio data to the AI Server via gRPC stream.
		if err := sender.Send(pcmData); err != nil {
			log.Printf("Pipeline stopped: failed to send to grpc: %v\n", err)
			return
		}

		// TODO: Implement optional logging or metrics for monitoring data throughput.
	}
}
