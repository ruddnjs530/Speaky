package upstream

import (
	"context"

	pb "mediaserver/proto"
)

// VoiceStream abstracts the gRPC stream for testing
type VoiceStream interface {
	Send(*pb.AudioChunk) error
	Recv() (*pb.AudioChunk, error)
	Close() error
}

// VoiceProcessor abstracts the AI client creation for testing
type VoiceProcessor interface {
	NewStream(ctx context.Context) (VoiceStream, error)
}
