package media

import (
	"context"
	"testing"
	"time"

	"github.com/pion/rtp"
	"github.com/stretchr/testify/assert"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
)

// TestRoom_Join_WiresPipeline verifies that wiring connects Receiver -> Transcoder.
// It directly calls the unexported wirePipeline method.
func TestRoom_Join_WiresPipeline(t *testing.T) {
	// 1. Setup
	cfg := &config.Config{}
	roomID := "test-room"
	userID := "test-user"
	room := NewRoom(roomID, cfg, nil)

	// Create Mocks
	mockReceiver := &MockReceiver{}
	mockTranscoder := NewMockTranscoder()
	mockSender := &MockSender{}

	// Setup Participant
	participant := &Participant{
		ID:         userID,
		Receiver:   mockReceiver,
		Transcoder: mockTranscoder,
		Sender:     mockSender,
		CancelFunc: func() {},
	}
	room.participants[userID] = participant

	// 2. Execute Wiring (Direct call to internal method)
	room.wirePipeline(context.Background(), participant)

	// 3. Assert Wiring: Receiver -> Transcoder
	// Verify OnAudioPacket is set
	if mockReceiver.OnAudioPacketFunc == nil {
		t.Fatal("Receiver.OnAudioPacket check failed: callback not registered (Did you implement wirePipeline?)")
	}

	// 4. Simulate Data Flow
	// Fire the callback with a dummy RTP packet
	dummyPayload := []byte{0x01, 0x02, 0x03, 0x04}
	packet := &rtp.Packet{Payload: dummyPayload}

	// Capturing WriteOpus call
	var capturedPacket *rtp.Packet
	mockTranscoder.WriteOpusFunc = func(p *rtp.Packet) error {
		capturedPacket = p
		return nil
	}

	// Trigger Callback
	mockReceiver.OnAudioPacketFunc(packet)

	// Assert Transcoder received payload
	assert.Equal(t, packet, capturedPacket, "Transcoder should receive packet from Receiver")
}

// TestRoom_Close_StopsPipeline verifies that the pump goroutine stops when Room is closed.
func TestRoom_Close_StopsPipeline(t *testing.T) {
	// 1. Setup Room and Context
	room := NewRoom("test-lifecycle", &config.Config{}, nil)
	pCtx, _ := context.WithCancel(room.Context()) // Derived from Room context

	mockTranscoder := NewMockTranscoder()
	mockSender := &MockSender{}

	participant := &Participant{
		Transcoder: mockTranscoder,
		Sender:     mockSender,
		CancelFunc: func() {}, // Not testing cancelFunc directly here, but context propagation
	}

	// 2. Start Pump
	done := make(chan struct{})
	go func() {
		room.pumpAudio(pCtx, participant)
		close(done)
	}()

	// Simulate running state
	// (If pumpAudio is implemented correctly, it waits on ReadPCM or Context)

	// 3. Action: Close Room
	// This cancels room.ctx, which should propagate to pCtx if wired correctly (here we manually derived pCtx)
	// In reality Join does this derivation. Here we simulate the dependency by deriving pCtx from room.ctx.
	room.Close()

	// 4. Assert: Pump stops
	select {
	case <-done:
		// Success
	case <-time.After(1 * time.Second):
		t.Fatal("Pump logic did not stop after Room.Close() (Goroutine Leak)")
	}
}
