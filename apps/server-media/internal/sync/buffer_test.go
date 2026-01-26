package sync

import (
	"testing"
	"time"
)

func TestVideoBuffer_Delay(t *testing.T) {
	// Configure short delay for testing (e.g., 50ms)
	delay := 50 * time.Millisecond
	vb := NewVideoBuffer(10, 100, delay)

	// Push packet
	vb.Push([]byte("frame1"))

	// 1. Check immediately (Should not be ready)
	_, ready := vb.PopReady()
	if ready {
		t.Error("Packet popped immediately, expected delay")
	}

	// 2. Wait > delay
	time.Sleep(delay + 10*time.Millisecond)

	// 3. Check again (Should be ready)
	if vb.Len() != 1 {
		t.Errorf("Expected len 1, got %d", vb.Len())
	}

	data, ready := vb.PopReady()
	if !ready {
		t.Error("Packet not ready after delay")
	}
	if string(data) != "frame1" {
		t.Errorf("Got wrong data: %s", string(data))
	}
}

func TestVideoBuffer_Overflow(t *testing.T) {
	vb := NewVideoBuffer(3, 100, 0) // Zero delay for instant pop

	// Fill buffer
	vb.Push([]byte("1"))
	vb.Push([]byte("2"))
	vb.Push([]byte("3"))

	// Overflow (should drop "1")
	vb.Push([]byte("4"))

	// Pop all
	d1, _ := vb.PopReady()
	d2, _ := vb.PopReady()
	d3, _ := vb.PopReady()

	if string(d1) != "2" {
		t.Errorf("Expected 2, got %s", d1)
	}
	if string(d2) != "3" {
		t.Errorf("Expected 3, got %s", d2)
	}
	if string(d3) != "4" {
		t.Errorf("Expected 4, got %s", d3)
	}
}
