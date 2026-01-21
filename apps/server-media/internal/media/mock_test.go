package media

import (
	"context"
	"io"
	"sync"
	"time"

	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/pipeline"
)

// MockReceiver implements webrtc.Receiver interface for testing.
type MockReceiver struct {
	mu            sync.Mutex
	OnAudioPacketFunc func(*rtp.Packet)
	OnVideoPacketFunc func(*rtp.Packet)
	ConnectFunc       func(string) (string, error)
	AddCandidateFunc  func(webrtc.ICECandidateInit) error
	CloseFunc         func() error
}

func (m *MockReceiver) Connect(offerSDP string) (string, error) {
	if m.ConnectFunc != nil {
		return m.ConnectFunc(offerSDP)
	}
	return "mock-answer", nil
}

func (m *MockReceiver) OnAudioPacket(callback func(*rtp.Packet)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.OnAudioPacketFunc = callback
}

func (m *MockReceiver) OnVideoPacket(callback func(*rtp.Packet)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.OnVideoPacketFunc = callback
}

func (m *MockReceiver) AddICECandidate(candidate webrtc.ICECandidateInit) error {
	if m.AddCandidateFunc != nil {
		return m.AddCandidateFunc(candidate)
	}
	return nil
}

func (m *MockReceiver) Close() error {
	if m.CloseFunc != nil {
		return m.CloseFunc()
	}
	return nil
}

// MockTranscoder implements pipeline.Transcoder interface for testing.
type MockTranscoder struct {
	mu           sync.Mutex
	WriteOpusFunc func(*rtp.Packet) error
	ReadPCMFunc   func(context.Context) (*pipeline.AudioFrame, error)
	CloseFunc     func() error

	// Channel to simulate data flow or blocking
	PcmOutputChan chan *pipeline.AudioFrame
}

func NewMockTranscoder() *MockTranscoder {
	return &MockTranscoder{
		PcmOutputChan: make(chan *pipeline.AudioFrame, 10),
	}
}

func (m *MockTranscoder) WriteOpus(packet *rtp.Packet) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.WriteOpusFunc != nil {
		return m.WriteOpusFunc(packet)
	}
	// Default behavior: Pass to output if strictly unit testing flow
	return nil
}

func (m *MockTranscoder) ReadPCM(ctx context.Context) (*pipeline.AudioFrame, error) {
	m.mu.Lock()
	if m.ReadPCMFunc != nil {
		m.mu.Unlock()
		return m.ReadPCMFunc(ctx)
	}
	m.mu.Unlock()

	select {
	case data := <-m.PcmOutputChan:
		return data, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(100 * time.Millisecond): // Timeout to prevent deadlocks in tests
		return nil, io.EOF
	}
}

func (m *MockTranscoder) Close() error {
	if m.CloseFunc != nil {
		return m.CloseFunc()
	}
	return nil
}

// MockSender implements upstream.AudioSender interface for testing.
type MockSender struct {
	mu       sync.Mutex
	SendFunc func(*pipeline.AudioFrame) error
	CloseFunc func() error
	
	SentData []*pipeline.AudioFrame
}

func (m *MockSender) Send(frame *pipeline.AudioFrame) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.SentData = append(m.SentData, frame)
	if m.SendFunc != nil {
		return m.SendFunc(frame)
	}
	return nil
}

func (m *MockSender) Close() error {
	if m.CloseFunc != nil {
		return m.CloseFunc()
	}
	return nil
}
