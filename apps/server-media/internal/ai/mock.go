package ai

import (
	"context"
	"io"
	"sync"
	"time"

	pb "mediaserver/proto"
)

// MockClient is a mock implementation of Client.
type MockClient struct {
	StreamFunc func(context.Context) (Stream, error)
}

// NewMockClient creates a new MockClient.
func NewMockClient() *MockClient {
	return &MockClient{}
}

func (m *MockClient) NewStream(ctx context.Context) (Stream, error) {
	if m.StreamFunc != nil {
		return m.StreamFunc(ctx)
	}
	return NewMockStream(ctx), nil
}

func (m *MockClient) Close() error {
	return nil
}

// MockStream implements Stream.
type MockStream struct {
	ctx       context.Context
	inputChan chan *pb.AudioChunk
	mu        sync.Mutex
	closed    bool
	delay     time.Duration
}

func NewMockStream(ctx context.Context) *MockStream {
	return &MockStream{
		ctx:       ctx,
		inputChan: make(chan *pb.AudioChunk, 100),
	}
}

func (s *MockStream) SetDelay(d time.Duration) {
	s.delay = d
}

func (s *MockStream) Send(chunk *pb.AudioChunk) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return io.EOF
	}

	select {
	case <-s.ctx.Done():
		return s.ctx.Err()
	case s.inputChan <- chunk:
		return nil
	}
}

func (s *MockStream) Recv() (*pb.AudioChunk, error) {
	// Simulate processing delay if configured
	if s.delay > 0 {
		select {
		case <-s.ctx.Done():
			return nil, s.ctx.Err()
		case <-time.After(s.delay):
		}
	}

	select {
	case <-s.ctx.Done():
		return nil, s.ctx.Err()
	case chunk, ok := <-s.inputChan:
		if !ok {
			return nil, io.EOF
		}
		// Echo logic default
		return chunk, nil
	}
}

func (s *MockStream) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.closed {
		close(s.inputChan)
		s.closed = true
	}
	return nil
}
