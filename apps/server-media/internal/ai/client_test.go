package ai

import (
	"context"
	"io"
	"testing"
	"time"

	pb "mediaserver/proto"
)

func TestMockStream_Loopback(t *testing.T) {
	// 1. Create Mock Client
	mock := &MockClient{}
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	// 2. Create Stream
	stream, err := mock.NewStream(ctx)
	if err != nil {
		t.Fatalf("NewStream failed: %v", err)
	}

	// 3. Send Data
	chunk := &pb.AudioChunk{
		Pcm:        []byte{1, 2, 3, 4},
		SampleRate: 24000,
	}
	if err := stream.Send(chunk); err != nil {
		t.Fatalf("Send failed: %v", err)
	}

	// 4. Recv Data (Echo)
	recv, err := stream.Recv()
	if err != nil {
		t.Fatalf("Recv failed: %v", err)
	}

	if string(recv.Pcm) != string(chunk.Pcm) {
		t.Errorf("Expected %v, got %v", chunk.Pcm, recv.Pcm)
	}

	// 5. Close
	if err := stream.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	// 6. Verify EOF
	_, err = stream.Recv()
	if err != io.EOF {
		t.Errorf("Expected EOF after close, got %v", err)
	}
}
