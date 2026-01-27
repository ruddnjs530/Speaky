package pipeline

import (
	"context"
	"testing"
	"time"
)

func TestQueue_NewQueue(t *testing.T) {
	q := NewQueue[int](10)

	if q.Cap() != 10 {
		t.Errorf("Expected capacity 10, got %d", q.Cap())
	}

	if q.Len() != 0 {
		t.Errorf("Expected empty queue, got size %d", q.Len())
	}

	if q.IsClosed() {
		t.Error("Expected queue to be open")
	}
}

func TestQueue_PushPop(t *testing.T) {
	q := NewQueue[string](5)
	ctx := context.Background()

	// Push some data
	data1 := "packet1"
	if err := q.Push(data1); err != nil {
		t.Fatalf("Push failed: %v", err)
	}

	if q.Len() != 1 {
		t.Errorf("Expected size 1, got %d", q.Len())
	}

	// Pop data
	result, err := q.Pop(ctx)
	if err != nil {
		t.Fatalf("Pop failed: %v", err)
	}

	if result != data1 {
		t.Errorf("Expected %s, got %s", data1, result)
	}

	if q.Len() != 0 {
		t.Errorf("Expected empty queue after pop, got size %d", q.Len())
	}
}

func TestQueue_RingBufferOverflow(t *testing.T) {
	capacity := 3
	q := NewQueue[int](capacity)

	// Fill queue
	for i := 0; i < capacity; i++ {
		if err := q.Push(i); err != nil {
			t.Fatalf("Push %d failed: %v", i, err)
		}
	}

	if q.Len() != capacity {
		t.Errorf("Expected size %d, got %d", capacity, q.Len())
	}

	// Overflow: push one more (should drop oldest '0')
	if err := q.Push(99); err != nil {
		t.Fatalf("Overflow push failed: %v", err)
	}

	// Size should remain at capacity
	if q.Len() != capacity {
		t.Errorf("Expected size %d after overflow, got %d", capacity, q.Len())
	}

	// Pop all
	ctx := context.Background()
	results := make([]int, 0, capacity)
	for i := 0; i < capacity; i++ {
		val, err := q.Pop(ctx)
		if err != nil {
			t.Fatalf("Pop %d failed: %v", i, err)
		}
		results = append(results, val)
	}

	// Should have: [1, 2, 99] (0 was dropped)
	expected := []int{1, 2, 99}
	for i, res := range results {
		if res != expected[i] {
			t.Errorf("Position %d: expected %d, got %d", i, expected[i], res)
		}
	}
}

func TestQueue_BlockingPop(t *testing.T) {
	q := NewQueue[int](5)
	ctx := context.Background()

	// Start Pop in goroutine (will block)
	resultCh := make(chan int)
	errCh := make(chan error)

	go func() {
		data, err := q.Pop(ctx)
		if err != nil {
			errCh <- err
			return
		}
		resultCh <- data
	}()

	// Give goroutine time to start waiting
	time.Sleep(50 * time.Millisecond)

	// Push data (should wake up Pop)
	testData := 123
	if err := q.Push(testData); err != nil {
		t.Fatalf("Push failed: %v", err)
	}

	// Pop should complete
	select {
	case data := <-resultCh:
		if data != testData {
			t.Errorf("Expected %d, got %d", testData, data)
		}
	case err := <-errCh:
		t.Fatalf("Pop failed: %v", err)
	case <-time.After(1 * time.Second):
		t.Fatal("Pop did not complete (timeout)")
	}
}

func TestQueue_Peek(t *testing.T) {
	q := NewQueue[int](5)

	// Empty peek
	val, ok := q.Peek()
	if ok {
		t.Error("Expected Peek on empty queue to return false")
	}
	if val != 0 {
		t.Error("Expected zero value")
	}

	// Push
	q.Push(100)

	// Peek
	val, ok = q.Peek()
	if !ok {
		t.Error("Expected Peek to return true")
	}
	if val != 100 {
		t.Errorf("Expected 100, got %d", val)
	}

	// Ensure not removed
	if q.Len() != 1 {
		t.Errorf("Len changed after Peek")
	}
}

func TestQueue_Close(t *testing.T) {
	q := NewQueue[int](5)
	ctx := context.Background()

	// Push some data
	q.Push(1)

	// Close queue
	if err := q.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	if !q.IsClosed() {
		t.Error("Expected queue to be closed")
	}

	// Push after close should fail
	if err := q.Push(2); err != ErrQueueClosed {
		t.Errorf("Expected ErrQueueClosed, got %v", err)
	}

	// Pop existing data should succeed
	data, err := q.Pop(ctx)
	if err != nil {
		t.Fatalf("Pop existing data failed: %v", err)
	}
	if data != 1 {
		t.Errorf("Expected 1, got %d", data)
	}

	// Pop from empty closed queue should fail
	_, err = q.Pop(ctx)
	if err != ErrQueueClosed {
		t.Errorf("Expected ErrQueueClosed on empty closed queue, got %v", err)
	}
}

func BenchmarkQueue_Push(b *testing.B) {
	q := NewQueue[int](1000)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		q.Push(i)
	}
}

func BenchmarkQueue_Pop(b *testing.B) {
	q := NewQueue[int](b.N + 1) // Ensure capacity
	ctx := context.Background()

	// Fill queue
	for i := 0; i < b.N; i++ {
		q.Push(i)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		q.Pop(ctx)
	}
}
