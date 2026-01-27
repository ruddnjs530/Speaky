package sync

import (
	"testing"
	"time"

	"speaky-media/internal/pipeline"
)

func TestVideoBuffer_Delay(t *testing.T) {
	// Configure short delay for testing (e.g., 50ms)
	delay := 50 * time.Millisecond
	vb := NewVideoBuffer(10, delay)

	// Push packet
	vb.Push(pipeline.RTPPacket{Data: []byte("frame1"), ArrivalTime: time.Now()})

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
	vb := NewVideoBuffer(3, 0) // Zero delay for instant pop

	// Fill buffer
	vb.Push(pipeline.RTPPacket{Data: []byte("1"), ArrivalTime: time.Now()})
	vb.Push(pipeline.RTPPacket{Data: []byte("2"), ArrivalTime: time.Now()})
	vb.Push(pipeline.RTPPacket{Data: []byte("3"), ArrivalTime: time.Now()})

	// Overflow (should drop "1")
	vb.Push(pipeline.RTPPacket{Data: []byte("4"), ArrivalTime: time.Now()})

	// Pop all
	d1, _ := vb.PopReady() // 2
	d2, _ := vb.PopReady() // 3
	d3, _ := vb.PopReady() // 4

	if string(d1) != "2" || string(d2) != "3" || string(d3) != "4" {
		t.Error("Overflow logic failed (wrong items dropped)")
	}
}

func TestVideoBuffer_SetDelay(t *testing.T) {
	// Initial delay 100ms
	vb := NewVideoBuffer(10, 100*time.Millisecond)

	// Push packet
	vb.Push(pipeline.RTPPacket{Data: []byte("frame"), ArrivalTime: time.Now()})

	// Wait 50ms. 50 < 100. Not ready.
	time.Sleep(50 * time.Millisecond)
	if _, ready := vb.PopReady(); ready {
		t.Error("Popped too early (initial delay 100ms)")
	}

	// Increase delay to 200ms
	vb.SetDelay(200 * time.Millisecond)

	// Wait another 100ms. Total 150ms. 150 < 200. Still not ready.
	time.Sleep(100 * time.Millisecond)
	if _, ready := vb.PopReady(); ready {
		t.Error("Popped too early (delay increased to 200ms)")
	}

	// Wait another 100ms. Total 250ms > 200. Should be ready.
	time.Sleep(100 * time.Millisecond)
	if _, ready := vb.PopReady(); !ready {
		t.Error("Not ready after wait (total > 200ms)")
	}
}
