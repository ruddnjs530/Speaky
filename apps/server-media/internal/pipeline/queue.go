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
)

// Queue is a thread-safe bounded ring buffer for generic items.
// It implements a circular buffer with the following properties:
// - Push is non-blocking: if full, it overwrites the oldest item (FIFO eviction).
// - Pop is blocking: waits for data or context cancellation.
// - Closing the queue wakes up all waiting Pop() calls.
type Queue[T any] struct {
	buf      []T         // Circular buffer
	capacity int         // Maximum number of items
	head     int         // Read position
	tail     int         // Write position
	size     int         // Current number of items
	closed   bool        // Queue closed flag
	mu       sync.Mutex  // Protects all fields
	notEmpty *sync.Cond  // Signals when queue becomes non-empty
}

// NewQueue creates a new generic Queue with specified capacity.
func NewQueue[T any](capacity int) *Queue[T] {
	q := &Queue[T]{
		buf:      make([]T, capacity),
		capacity: capacity,
		head:     0,
		tail:     0,
		size:     0,
		closed:   false,
	}
	q.notEmpty = sync.NewCond(&q.mu)
	return q
}

// Push adds an item to the queue.
// If the queue is full, it overwrites the oldest item (ring buffer behavior).
// Returns ErrQueueClosed if the queue has been closed.
// This operation never blocks.
func (q *Queue[T]) Push(item T) error {
	q.mu.Lock()
	defer q.mu.Unlock()

	if q.closed {
		return ErrQueueClosed
	}

	// Insert at tail
	q.buf[q.tail] = item

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

// Pop removes and returns an item from the queue.
// It blocks until:
// - An item is available, or
// - The context is cancelled, or
// - The queue is closed AND empty
func (q *Queue[T]) Pop(ctx context.Context) (T, error) {
	q.mu.Lock()
	defer q.mu.Unlock()

	var zero T // Zero value for error returns

	// Wait for data or termination
	for q.size == 0 && !q.closed {
		// Check context
		select {
		case <-ctx.Done():
			return zero, ctx.Err()
		default:
		}

		done := make(chan struct{})
		go func() {
			select {
			case <-ctx.Done():
				q.notEmpty.Signal()
			case <-done:
			}
		}()

		q.notEmpty.Wait()
		close(done)

		select {
		case <-ctx.Done():
			return zero, ctx.Err()
		default:
		}
	}

	if q.size == 0 {
		if q.closed {
			return zero, ErrQueueClosed
		}
		return zero, ErrQueueEmpty
	}

	// Pop from head
	item := q.buf[q.head]
	// Optional: zero out the buffer slot to avoid leaks if T contains pointers
	// q.buf[q.head] = zero
	// (Go doesn't really need this unless capacity is huge and T is large)

	q.head = (q.head + 1) % q.capacity
	q.size--

	return item, nil
}

// Peek returns the item at the head of the queue without removing it.
// Returns matched item and true if queue is not empty, otherwise zero value and false.
func (q *Queue[T]) Peek() (T, bool) {
	q.mu.Lock()
	defer q.mu.Unlock()

	var zero T
	if q.size == 0 {
		return zero, false
	}
	return q.buf[q.head], true
}

// Len returns the current number of items.
func (q *Queue[T]) Len() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return q.size
}

// Cap returns the queue capacity.
func (q *Queue[T]) Cap() int {
	return q.capacity
}

// Close closes the queue and wakes up all waiting Pop() calls.
func (q *Queue[T]) Close() error {
	q.mu.Lock()
	defer q.mu.Unlock()

	if q.closed {
		return nil
	}

	q.closed = true
	q.notEmpty.Broadcast()
	return nil
}

// IsClosed returns true if the queue has been closed.
func (q *Queue[T]) IsClosed() bool {
	q.mu.Lock()
	defer q.mu.Unlock()
	return q.closed
}
