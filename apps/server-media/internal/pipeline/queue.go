package pipeline

import (
	"context"
	"errors"
	"sync"
)

var (
	// ErrQueueClosed is returned when operating on a closed queue
	ErrQueueClosed = errors.New("queue is closed")
	// ErrQueueEmpty is returned when popping from an empty queue (non-blocking mode)
	ErrQueueEmpty = errors.New("queue is empty")
	// ErrPacketTooLarge is returned when pushing a packet larger than MaxSize
	ErrPacketTooLarge = errors.New("packet too large")
)

// Queue is a thread-safe bounded ring buffer for RTP packets.
// It implements a circular buffer with the following properties:
// - Push is non-blocking: if full, it overwrites the oldest packet (FIFO eviction)
// - Pop is blocking: waits for data or context cancellation
// - Closing the queue wakes up all waiting Pop() calls
type Queue struct {
	buf      [][]byte    // Circular buffer of packet data
	capacity int         // Maximum number of packets
	maxSize  int         // Maximum size per packet
	head     int         // Read position
	tail     int         // Write position
	size     int         // Current number of packets
	closed   bool        // Queue closed flag
	mu       sync.Mutex  // Protects all fields
	notEmpty *sync.Cond  // Signals when queue becomes non-empty
}

// NewQueue creates a new Queue with specified capacity and max packet size.
// capacity: Maximum number of packets the queue can hold
// maxPacketSize: Maximum size of each packet in bytes (typically 1500 for RTP)
func NewQueue(capacity int, maxPacketSize int) *Queue {
	q := &Queue{
		buf:      make([][]byte, capacity),
		capacity: capacity,
		maxSize:  maxPacketSize,
		head:     0,
		tail:     0,
		size:     0,
		closed:   false,
	}
	q.notEmpty = sync.NewCond(&q.mu)

	// Pre-allocate buffers to reduce GC pressure
	for i := range q.buf {
		q.buf[i] = make([]byte, 0, maxPacketSize)
	}

	return q
}

// Push adds a packet to the queue.
// If the queue is full, it overwrites the oldest packet (ring buffer behavior).
// Returns ErrQueueClosed if the queue has been closed, or ErrPacketTooLarge if data exceeds maxPacketSize.
// This operation never blocks.
func (q *Queue) Push(data []byte) error {
	q.mu.Lock()
	defer q.mu.Unlock()

	if q.closed {
		return ErrQueueClosed
	}

	if len(data) > q.maxSize {
		return ErrPacketTooLarge
	}

	// Copy data to buffer at tail position
	q.buf[q.tail] = append(q.buf[q.tail][:0], data...)

	// Advance tail
	q.tail = (q.tail + 1) % q.capacity

	// If buffer is full, advance head (overwrite oldest)
	if q.size == q.capacity {
		q.head = (q.head + 1) % q.capacity
	} else {
		q.size++
	}

	// Signal waiting Pop() calls
	q.notEmpty.Signal()

	return nil
}

// Pop removes and returns a packet from the queue.
// It blocks until:
// - A packet is available, or
// - The context is cancelled, or
// - The queue is closed AND empty
//
// Returns:
// - data: The packet data (caller must copy if needed for long-term storage)
// - error: ErrQueueClosed if closed and empty, context error if cancelled, nil on success
func (q *Queue) Pop(ctx context.Context) ([]byte, error) {
	q.mu.Lock()
	defer q.mu.Unlock()

	// Wait for data or termination
	for q.size == 0 && !q.closed {
		// Check context before waiting
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		// Wait for signal (releases lock, reacquires on wake)
		// We need to handle spurious wakeups
		done := make(chan struct{})
		go func() {
			select {
			case <-ctx.Done():
				q.notEmpty.Signal() // Wake up waiting goroutine
			case <-done:
			}
		}()

		q.notEmpty.Wait()
		close(done)

		// Re-check context after waking
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}
	}

	// If queue is empty (either closed or not), return appropriate error
	if q.size == 0 {
		if q.closed {
			return nil, ErrQueueClosed
		}
		// Should not reach here due to loop condition, but safety check
		return nil, ErrQueueEmpty
	}

	// Pop from head (queue has data)
	data := q.buf[q.head]
	q.head = (q.head + 1) % q.capacity
	q.size--

	// Return a copy to avoid race conditions
	result := make([]byte, len(data))
	copy(result, data)

	return result, nil
}

// Len returns the current number of packets in the queue.
func (q *Queue) Len() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return q.size
}

// Cap returns the queue capacity.
func (q *Queue) Cap() int {
	return q.capacity
}

// Close closes the queue and wakes up all waiting Pop() calls.
// After closing, Push() returns ErrQueueClosed and Pop() returns ErrQueueClosed
// once the queue is drained.
func (q *Queue) Close() error {
	q.mu.Lock()
	defer q.mu.Unlock()

	if q.closed {
		return nil
	}

	q.closed = true
	q.notEmpty.Broadcast() // Wake all waiting Pop() calls

	return nil
}

// IsClosed returns true if the queue has been closed.
func (q *Queue) IsClosed() bool {
	q.mu.Lock()
	defer q.mu.Unlock()
	return q.closed
}
