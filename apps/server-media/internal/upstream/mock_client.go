package upstream

import (
	"context"
	"io"
	"sync"
	"time"

	pb "mediaserver/proto"
)

// MockVoiceProcessor implements VoiceProcessor for verification
type MockVoiceProcessor struct {
	mu            sync.Mutex
	Connected     bool
	StreamCreated bool
	SimulateDelay time.Duration
	SimulateError error
}

func NewMockVoiceProcessor() *MockVoiceProcessor {
	return &MockVoiceProcessor{}
}

func (m *MockVoiceProcessor) NewStream(ctx context.Context) (VoiceStream, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.SimulateError != nil {
		return nil, m.SimulateError
	}
	m.StreamCreated = true

	// Create channels for communication between Send/Recv
	// Using a buffered channel to simulate the network pipe
	pipe := make(chan *pb.AudioChunk, 100)

	return &MockVoiceStream{
		pipe:  pipe,
		delay: m.SimulateDelay,
		ctx:   ctx,
	}, nil
}

// MockVoiceStream implements VoiceStream
type MockVoiceStream struct {
	pipe  chan *pb.AudioChunk
	delay time.Duration
	ctx   context.Context
}

func (s *MockVoiceStream) Send(chunk *pb.AudioChunk) error {
	select {
	case <-s.ctx.Done():
		return s.ctx.Err()
	default:
		// Simulate processing delay asynchronously (Pipelining)
		if s.delay > 0 {
			go func(c *pb.AudioChunk) {
				// Wait for delay
				select {
				case <-time.After(s.delay):
					// Try to push to pipe
					select {
					case s.pipe <- c:
					case <-s.ctx.Done():
					}
				case <-s.ctx.Done():
				}
			}(chunk)
			return nil
		}

		// Echo: Push to pipe
		s.pipe <- chunk
		return nil
	}
}

func (s *MockVoiceStream) Recv() (*pb.AudioChunk, error) {
	select {
	case <-s.ctx.Done():
		return nil, s.ctx.Err()
	case chunk, ok := <-s.pipe:
		if !ok {
			return nil, io.EOF
		}
		return chunk, nil
	}
}

func (s *MockVoiceStream) Close() error {
	close(s.pipe)
	return nil
}
