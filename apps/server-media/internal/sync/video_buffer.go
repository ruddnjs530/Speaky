package sync

import (
	"context"
	"sync"
	"time"

	"speaky-media/internal/pipeline"
)

var (
	ErrQueueEmpty = pipeline.ErrQueueEmpty
)

// VideoBuffer buffers video packets for a fixed duration to sync with audio pipeline.
// It wraps generic pipeline.Queue[RTPPacket] and uses packet metadata for timing.
type VideoBuffer struct {
	queue *pipeline.Queue[pipeline.RTPPacket]
	mu    sync.Mutex
	delay time.Duration
}

// NewVideoBuffer creates a new video delay buffer.
// maxPacketSize is removed as Queue is generic now.
func NewVideoBuffer(capacity int, delay time.Duration) *VideoBuffer {
	return &VideoBuffer{
		queue: pipeline.NewQueue[pipeline.RTPPacket](capacity),
		delay: delay,
	}
}

// Push adds a video packet.
func (vb *VideoBuffer) Push(packet pipeline.RTPPacket) error {
	vb.mu.Lock()
	defer vb.mu.Unlock()
	// 2. Push to queue (Handles overflow internally)
	return vb.queue.Push(packet)
}

// PopReady returns a packet IF it is older than the configured delay.
// Returns (data, true) if ready.
// Returns (nil, false) if empty or not old enough.
func (vb *VideoBuffer) PopReady() ([]byte, bool) {
	vb.mu.Lock()
	defer vb.mu.Unlock()

	// 1. Peek at head
	packet, ok := vb.queue.Peek()
	if !ok {
		return nil, false
	}

	// 2. Check age
	age := time.Since(packet.ArrivalTime)
	if age < vb.delay {
		// Log occasionally (every ~1s if polled at 10ms)
		// We can't easily count here without state.
		// Use a minimal check or rely on caller to log?
		// Let's just remove the internal log spam or make it conditional on a very specific modulus of something?
		// Better: Don't log here. Let caller log if buffer is growing too large.
		return nil, false
	}

	// 3. Ready to pop (We know it's there because Peek succeeded)
	// Pop is technically blocking but we verified existence.
	// Use background context for instant return.
	data, err := vb.queue.Pop(context.Background())
	if err != nil {
		// Should not happen unless closed concurrently
		return nil, false
	}

	return data.Data, true
}

// SetDelay updates the target delay dynamically.
// Used for Adaptive Sync.
func (vb *VideoBuffer) SetDelay(d time.Duration) {
	vb.mu.Lock()
	defer vb.mu.Unlock()
	vb.delay = d
}

// Len returns number of buffered packets
func (vb *VideoBuffer) Len() int {
	return vb.queue.Len()
}

// Cap returns the buffer capacity
func (vb *VideoBuffer) Cap() int {
	return vb.queue.Cap()
}

// Close closes the underlying queue
func (vb *VideoBuffer) Close() error {
	return vb.queue.Close()
}
