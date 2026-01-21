package test

import (
	"context"
	"io"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "mediaserver/proto"
)

func TestAICommunication(t *testing.T) {
	// Skip if INTEGRATION_TEST is not set
	if os.Getenv("INTEGRATION_TEST") == "" {
		t.Skip("Skipping integration test: set INTEGRATION_TEST=1 to run")
	}

	// Connect to Server-AI
	// Assumes server-ai is running on localhost:50051
	// In a real CI, you might spin up the container here or expect it pre-launched.
	conn, err := grpc.NewClient("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	require.NoError(t, err, "Failed to connect to gRPC server")
	defer conn.Close()

	client := pb.NewVoiceServiceClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Test GetStatus
	t.Run("GetStatus", func(t *testing.T) {
		resp, err := client.GetStatus(ctx, &pb.StatusRequest{})
		require.NoError(t, err)
		assert.Equal(t, "READY", resp.Status)
	})

	// 2. Test ConvertStream (Echo)
	t.Run("ConvertStream", func(t *testing.T) {
		stream, err := client.ConvertStream(ctx)
		require.NoError(t, err)

		waitc := make(chan struct{})

		// Receiver
		go func() {
			defer close(waitc)
			for {
				in, err := stream.Recv()
				if err == io.EOF {
					return
				}
				assert.NoError(t, err)
				if err == nil {
					// Verify echoed data
					// We expect 2 bytes and 48000 sample rate based on what we send below
					assert.Equal(t, 2, len(in.Pcm))
					assert.Equal(t, int32(48000), in.SampleRate)
					
					// [New] Verify Timestamp Echo
					assert.True(t, in.Timestamp > 0, "Timestamp should be non-zero")
					assert.Equal(t, uint32(0), in.Timestamp%1000, "Timestamp should be multiple of 1000")
				}
			}
		}()

		// Sender
		for i := 1; i <= 3; i++ { // Start from 1 to have non-zero timestamp
			ts := uint32(i * 1000)
			req := &pb.AudioChunk{
				Pcm:        []byte{byte(i), byte(i + 1)},
				SampleRate: 48000,
				Channels:   2,
				Timestamp:  ts,
			}
			err := stream.Send(req)
			assert.NoError(t, err)
		}
		stream.CloseSend()

		select {
		case <-waitc:
			// Success
		case <-ctx.Done():
			t.Fatal("Test timed out waiting for stream response")
		}
	})
}
