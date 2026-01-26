package pipeline

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestQueue_NewQueue(t *testing.T) {
	q := NewQueue(10, 1500)

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
	q := NewQueue(5, 100)
	ctx := context.Background()

	// Push some data
	data1 := []byte("packet1")
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

	if string(result) != string(data1) {
		t.Errorf("Expected %s, got %s", data1, result)
	}

	if q.Len() != 0 {
		t.Errorf("Expected empty queue after pop, got size %d", q.Len())
	}
}

func TestQueue_RingBufferOverflow(t *testing.T) {
	capacity := 3
	q := NewQueue(capacity, 100)

	// Fill queue
	for i := 0; i < capacity; i++ {
		data := []byte{byte(i)}
		if err := q.Push(data); err != nil {
			t.Fatalf("Push %d failed: %v", i, err)
		}
	}

	if q.Len() != capacity {
		t.Errorf("Expected size %d, got %d", capacity, q.Len())
	}

	// Overflow: push one more (should drop oldest)
	overflow := []byte{byte(99)}
	if err := q.Push(overflow); err != nil {
		t.Fatalf("Overflow push failed: %v", err)
	}

	// Size should remain at capacity
	if q.Len() != capacity {
		t.Errorf("Expected size %d after overflow, got %d", capacity, q.Len())
	}

	// Pop all - oldest (0) should be gone
	ctx := context.Background()
	results := make([][]byte, 0, capacity)
	for i := 0; i < capacity; i++ {
		data, err := q.Pop(ctx)
		if err != nil {
			t.Fatalf("Pop %d failed: %v", i, err)
		}
		results = append(results, data)
	}

	// Should have: [1, 2, 99] (0 was dropped)
	expected := []byte{1, 2, 99}
	for i, res := range results {
		if res[0] != expected[i] {
			t.Errorf("Position %d: expected %d, got %d", i, expected[i], res[0])
		}
	}
}

func TestQueue_BlockingPop(t *testing.T) {
	q := NewQueue(5, 100)
	ctx := context.Background()

	// Start Pop in goroutine (will block)
	resultCh := make(chan []byte)
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
	testData := []byte("wakeup")
	if err := q.Push(testData); err != nil {
		t.Fatalf("Push failed: %v", err)
	}

	// Pop should complete
	select {
	case data := <-resultCh:
		if string(data) != string(testData) {
			t.Errorf("Expected %s, got %s", testData, data)
		}
	case err := <-errCh:
		t.Fatalf("Pop failed: %v", err)
	case <-time.After(1 * time.Second):
		t.Fatal("Pop did not complete (timeout)")
	}
}

func TestQueue_ContextCancellation(t *testing.T) {
	q := NewQueue(5, 100)
	ctx, cancel := context.WithCancel(context.Background())

	// Start Pop with cancellable context
	errCh := make(chan error)
	go func() {
		_, err := q.Pop(ctx)
		errCh <- err
	}()

	// Give goroutine time to start waiting
	time.Sleep(50 * time.Millisecond)

	// Cancel context
	cancel()

	// Pop should return context error
	select {
	case err := <-errCh:
		if err != context.Canceled {
			t.Errorf("Expected context.Canceled, got %v", err)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("Pop did not return after context cancellation")
	}
}

func TestQueue_Close(t *testing.T) {
	q := NewQueue(5, 100)
	ctx := context.Background()

	// Push some data
	q.Push([]byte("data"))

	// Close queue
	if err := q.Close(); err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	if !q.IsClosed() {
		t.Error("Expected queue to be closed")
	}

	// Push after close should fail
	if err := q.Push([]byte("after close")); err != ErrQueueClosed {
		t.Errorf("Expected ErrQueueClosed, got %v", err)
	}

	// Pop existing data should succeed
	data, err := q.Pop(ctx)
	if err != nil {
		t.Fatalf("Pop existing data failed: %v", err)
	}
	if string(data) != "data" {
		t.Errorf("Expected 'data', got %s", data)
	}

	// Pop from empty closed queue should fail
	_, err = q.Pop(ctx)
	if err != ErrQueueClosed {
		t.Errorf("Expected ErrQueueClosed on empty closed queue, got %v", err)
	}
}

func TestQueue_CloseWakesWaiters(t *testing.T) {
	q := NewQueue(5, 100)
	ctx := context.Background()

	// Start multiple Pop goroutines
	const numWaiters = 5
	errCh := make(chan error, numWaiters)

	for i := 0; i < numWaiters; i++ {
		go func() {
			_, err := q.Pop(ctx)
			errCh <- err
		}()
	}

	// Give goroutines time to start waiting
	time.Sleep(100 * time.Millisecond)

	// Close queue (should wake all waiters)
	q.Close()

	// All waiters should return ErrQueueClosed
	for i := 0; i < numWaiters; i++ {
		select {
		case err := <-errCh:
			if err != ErrQueueClosed {
				t.Errorf("Waiter %d: expected ErrQueueClosed, got %v", i, err)
			}
		case <-time.After(1 * time.Second):
			t.Fatalf("Waiter %d did not wake up", i)
		}
	}
}

func TestQueue_ConcurrentPushPop(t *testing.T) {
	q := NewQueue(100, 1500)
	ctx := context.Background()

	const numProducers = 10
	const numConsumers = 10
	const packetsPerProducer = 100

	var wg sync.WaitGroup
	var producerWg sync.WaitGroup

	// Producers
	for i := 0; i < numProducers; i++ {
		wg.Add(1)
		producerWg.Add(1)
		go func(id int) {
			defer wg.Done()
			defer producerWg.Done()
			for j := 0; j < packetsPerProducer; j++ {
				data := []byte{byte(id), byte(j)}
				if err := q.Push(data); err != nil {
					t.Errorf("Producer %d: Push failed: %v", id, err)
					return
				}
			}
		}(i)
	}

	// Consumers
	received := make(chan []byte, numProducers*packetsPerProducer)
	for i := 0; i < numConsumers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for {
				data, err := q.Pop(ctx)
				if err == ErrQueueClosed {
					return
				}
				if err != nil {
					t.Errorf("Consumer %d: Pop failed: %v", id, err)
					return
				}
				received <- data
			}
		}(i)
	}

	// Wait for all producers to finish
	producerWg.Wait()

	// Close queue to stop consumers
	q.Close()

	// Wait for all consumers (and producers)
	wg.Wait()
	close(received)

	// Count received packets
	count := 0
	for range received {
		count++
	}

	// Should have received some packets (may lose some due to overflow)
	if count == 0 {
		t.Error("No packets received")
	}

	t.Logf("Sent: %d, Received: %d (%.1f%% delivery)",
		numProducers*packetsPerProducer,
		count,
		float64(count*100)/float64(numProducers*packetsPerProducer))
}

func TestQueue_DataIsolation(t *testing.T) {
	q := NewQueue(5, 100)
	ctx := context.Background()

	// Push data
	original := []byte{1, 2, 3}
	if err := q.Push(original); err != nil {
		t.Fatalf("Push failed: %v", err)
	}

	// Modify original
	original[0] = 99

	// Pop should get unmodified data
	result, err := q.Pop(ctx)
	if err != nil {
		t.Fatalf("Pop failed: %v", err)
	}

	if result[0] != 1 {
		t.Errorf("Data was modified: expected 1, got %d", result[0])
	}
}

// Benchmark tests
func BenchmarkQueue_Push(b *testing.B) {
	q := NewQueue(1000, 1500)
	data := make([]byte, 1200)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		q.Push(data)
	}
}

func BenchmarkQueue_Pop(b *testing.B) {
	q := NewQueue(b.N, 1500)
	ctx := context.Background()
	data := make([]byte, 1200)

	// Fill queue
	for i := 0; i < b.N; i++ {
		q.Push(data)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		q.Pop(ctx)
	}
}

func BenchmarkQueue_ConcurrentPushPop(b *testing.B) {
	q := NewQueue(1000, 1500)
	ctx := context.Background()
	data := make([]byte, 1200)

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			q.Push(data)
			q.Pop(ctx)
		}
	})
}
