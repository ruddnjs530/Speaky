package ai

import (
	"context"

	pb "mediaserver/proto"
)

// Client defines the capability to start a voice conversion stream.
// This interface allows the pipeline to be tested without a real gRPC connection.
// It matches the signature of upstream.Client.
type Client interface {
	NewStream(ctx context.Context) (Stream, error)
	Close() error
}

// Stream defines the bidirectional flow of audio data.
// It matches the signature of upstream.Stream.
type Stream interface {
	Send(chunk *pb.AudioChunk) error
	Recv() (*pb.AudioChunk, error)
	Close() error // Corresponds to CloseSend()
}
