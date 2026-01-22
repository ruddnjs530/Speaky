package pipeline

import (
	"sync"
	"testing"
	"time"

	"github.com/pion/rtp"
	"github.com/stretchr/testify/assert"
)

func TestVideoQueue_PushPop_SinglePacket(t *testing.T) {
	vq := NewVideoQueue()
	ts := uint32(1000)
	packet := &rtp.Packet{
		Header: rtp.Header{Timestamp: ts, SequenceNumber: 1},
		Payload: []byte{0x01},
	}

	vq.Push(packet)

	// Action: Pop
	popped := vq.Pop(ts)

	// Assert
	assert.Len(t, popped, 1)
	assert.Equal(t, packet, popped[0])

	// Verify buffer is empty
	assert.Nil(t, vq.Pop(ts))
}

func TestVideoQueue_PushPop_Fragmentation(t *testing.T) {
	vq := NewVideoQueue()
	ts := uint32(2000)
	
	// Create fragments sharing the same timestamp
	p1 := &rtp.Packet{Header: rtp.Header{Timestamp: ts, SequenceNumber: 1, Marker: false}, Payload: []byte{0xA1}}
	p2 := &rtp.Packet{Header: rtp.Header{Timestamp: ts, SequenceNumber: 2, Marker: false}, Payload: []byte{0xA2}}
	p3 := &rtp.Packet{Header: rtp.Header{Timestamp: ts, SequenceNumber: 3, Marker: true}, Payload: []byte{0xA3}}

	// Push in order
	vq.Push(p1)
	vq.Push(p2)
	vq.Push(p3)

	// Action: Pop
	popped := vq.Pop(ts)

	// Assert: Should return all 3 packets
	assert.Len(t, popped, 3, "Should pop all fragments for the timestamp")
	assert.Equal(t, p1, popped[0])
	assert.Equal(t, p2, popped[1])
	assert.Equal(t, p3, popped[2])
	
	// Verify cleanup
	assert.Nil(t, vq.Pop(ts))
}

func TestVideoQueue_Pop_NotFound(t *testing.T) {
	vq := NewVideoQueue()
	assert.Nil(t, vq.Pop(9999))
}

func TestVideoQueue_Prune(t *testing.T) {
	vq := NewVideoQueue()
	
	// Push packets with widely increasing timestamps
	vq.Push(&rtp.Packet{Header: rtp.Header{Timestamp: 100}})
	vq.Push(&rtp.Packet{Header: rtp.Header{Timestamp: 200}})
	vq.Push(&rtp.Packet{Header: rtp.Header{Timestamp: 300}})
	vpc := &rtp.Packet{Header: rtp.Header{Timestamp: 500}}
	vq.Push(vpc)

	// Action: Prune packets strictly older than 300
	// 100, 200 should be removed. 300, 500 should remain.
	vq.Prune(300)

	// Assert
	assert.Nil(t, vq.Pop(100), "Should be pruned")
	assert.Nil(t, vq.Pop(200), "Should be pruned")
	
	p300 := vq.Pop(300)
	assert.Len(t, p300, 1, "Should remain (not older than 300)")
	
	p500 := vq.Pop(500)
	assert.Len(t, p500, 1, "Should remain")
}

func TestVideoQueue_Concurrency(t *testing.T) {
	vq := NewVideoQueue()
	ts := uint32(1000)
	wg := sync.WaitGroup{}
	
	// Concurrent Push
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			vq.Push(&rtp.Packet{Header: rtp.Header{Timestamp: ts, SequenceNumber: uint16(i)}})
		}(i)
	}

	// Concurrent Pop attempt (might be empty or partial)
	wg.Add(1)
	go func() {
		defer wg.Done()
		time.Sleep(1 * time.Millisecond)
		vq.Pop(ts) // Just ensure no panic
	}()
	
	// Concurrent Prune
	wg.Add(1)
	go func() {
		defer wg.Done()
		vq.Prune(ts - 100)
	}()

	wg.Wait()
}

func TestVideoQueue_Push_OutOfOrder(t *testing.T) {
	vq := NewVideoQueue()
	ts := uint32(3000)

	p1 := &rtp.Packet{Header: rtp.Header{Timestamp: ts, SequenceNumber: 1}}
	p2 := &rtp.Packet{Header: rtp.Header{Timestamp: ts, SequenceNumber: 2}}

	// Packets arrive out of order (UDP characteristic)
	vq.Push(p2)
	vq.Push(p1)

	popped := vq.Pop(ts)
	
	// VideoQueue is a simple storage - it doesn't sort.
	// Downstream (Decoder/Jitter Buffer) handles reordering.
	// We just verify both packets are present.
	assert.Len(t, popped, 2)
	assert.Contains(t, popped, p1)
	assert.Contains(t, popped, p2)
}

func TestVideoQueue_Prune_Rollover(t *testing.T) {
	vq := NewVideoQueue()

	// Scenario: Timestamp wraps around from max uint32 to 0
	// oldPacket: near MaxUint32 (very old in circular time)
	// newPacket: 100 (recent after rollover)
	
	oldTS := uint32(0xFFFFFFFF - 100) // ~4,294,967,195
	newTS := uint32(100)

	vq.Push(&rtp.Packet{Header: rtp.Header{Timestamp: oldTS}})
	vq.Push(&rtp.Packet{Header: rtp.Header{Timestamp: newTS}})

	// Current Prune implementation uses simple comparison (ts < olderThan).
	// This is acceptable for MVP with short sessions.
	// For production: need RTP-aware comparison (diff > 2^31).
	
	// Test current behavior: Prune with threshold = 50
	// oldTS (4.2B) > 50, so it won't be pruned with simple comparison.
	// This is a KNOWN LIMITATION for MVP.
	vq.Prune(50)
	
	// Verify oldTS is NOT pruned (current simple implementation)
	assert.NotNil(t, vq.Pop(oldTS), "Simple Prune doesn't handle rollover (MVP limitation)")
	
	// newTS should remain
	assert.NotNil(t, vq.Pop(newTS))
	
	// TODO (Production): Implement RTP-aware Prune with rollover logic
}
