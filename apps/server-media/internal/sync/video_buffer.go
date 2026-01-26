package sync

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"speaky-media/internal/pipeline"
)

// TargetVideoDelay is the fixed delay duration to align with AI audio processing latency.
const TargetVideoDelay = 600 * time.Millisecond

var (
	ErrQueueEmpty = pipeline.ErrQueueEmpty
)

// VideoBuffer buffers video packets for a fixed duration to sync with audio pipeline.
// It wraps pipeline.Queue but adds time-based popping logic.
type VideoBuffer struct {
	queue        *pipeline.Queue
	// Parallel circular buffer of timestamps matching the data queue loop.
	timesQueue []time.Time
	timesHead  int
	timesTail  int
	timesSize  int
	timesCap   int
	mu         sync.Mutex
	delay      time.Duration
}

// NewVideoBuffer creates a new video delay buffer.
func NewVideoBuffer(capacity int, maxPacketSize int, delay time.Duration) *VideoBuffer {
	return &VideoBuffer{
		queue:      pipeline.NewQueue(capacity, maxPacketSize),
		timesQueue: make([]time.Time, capacity),
		timesCap:   capacity,
		delay:      delay,
	}
}

// Push adds a video packet and records its arrival time.
func (vb *VideoBuffer) Push(pkt []byte) error {
	vb.mu.Lock()
	defer vb.mu.Unlock()

	// 1. Check if full BEFORE pushing.
	// We need to know this to drop our timestamp if the underlying queue drops its head.
	isFull := vb.queue.Len() == vb.queue.Cap()

	// 2. Try Push
	if err := vb.queue.Push(pkt); err != nil {
		// If Push fails (e.g., Closed), we do NOT touch the timestamp queue.
		// This ensures sync is preserved.
		return err
	}

	// 3. If queue was full, it dropped the oldest packet. We must match that.
	if isFull {
		// Log only periodically in real prod, but here we warn.
		slog.Warn("Video buffer overflow - dropping packet timestamp")

		vb.timesHead = (vb.timesHead + 1) % vb.timesCap
		vb.timesSize--
	}

	// 4. Store newly arrived packet timestamp
	vb.timesQueue[vb.timesTail] = time.Now()
	vb.timesTail = (vb.timesTail + 1) % vb.timesCap
	vb.timesSize++

	return nil
}

// PopReady returns a packet IF it is older than TargetVideoDelay.
// Returns (data, true) if ready.
// Returns (nil, false) if empty or not old enough.
func (vb *VideoBuffer) PopReady() ([]byte, bool) {
	vb.mu.Lock()
	defer vb.mu.Unlock()

	if vb.queue.Len() == 0 {
		return nil, false
	}

	// Check age of head packet
	headParams := vb.timesQueue[vb.timesHead]
	age := time.Since(headParams)

	if age < vb.delay {
		return nil, false
	}

	// Ready to pop
	// Use non-blocking pop (context.Background) because we checked Len > 0
	// But pipeline.Queue.Pop is blocking. Since Len > 0, it won't block.
	data, err := vb.queue.Pop(context.Background())
	if err != nil {
		// Should not happen if logic is correct
		return nil, false
	}

	// Advance timestamp head
	vb.timesHead = (vb.timesHead + 1) % vb.timesCap
	vb.timesSize--

	return data, true
}

// Len returns number of buffered packets
func (vb *VideoBuffer) Len() int {
	return vb.queue.Len()
}

// Close closes the underlying queue
func (vb *VideoBuffer) Close() error {
	return vb.queue.Close()
}
