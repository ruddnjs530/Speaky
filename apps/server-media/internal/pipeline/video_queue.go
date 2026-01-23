package pipeline

import (
	"sync"

	"github.com/pion/rtp"
)

// QueueItem represents packets for a single timestamp
type QueueItem struct {
	Timestamp uint32
	Packets   []*rtp.Packet
}

// VideoQueue buffers video packets to account for AI processing delay.
// It supports frame fragmentation (multiple packets per timestamp).
// Uses an ordered slice to support "PopUntil" operations for loose synchronization.
type VideoQueue struct {
	mu     sync.RWMutex
	buffer []QueueItem
}

// NewVideoQueue creates a new initialized VideoQueue.
func NewVideoQueue() *VideoQueue {
	return &VideoQueue{
		buffer: make([]QueueItem, 0),
	}
}

// Len returns the current number of items (timestamps) in the queue.
func (vq *VideoQueue) Len() int {
	vq.mu.RLock()
	defer vq.mu.RUnlock()
	return len(vq.buffer)
}

// Push adds a packet to the queue while maintaining timestamp order.
// Handles timestamp rollover by checking the last element.
func (vq *VideoQueue) Push(packet *rtp.Packet) {
	vq.mu.Lock()
	defer vq.mu.Unlock()

	ts := packet.Timestamp
	newItem := QueueItem{Timestamp: ts, Packets: []*rtp.Packet{packet}}

	// Optimize for common case: new packet is newer than the last one
	if len(vq.buffer) == 0 {
		vq.buffer = append(vq.buffer, newItem)
		return
	}

	last := vq.buffer[len(vq.buffer)-1]
	// If ts >= last.Timestamp (handling simple case)
	// Or if ts is "newer" in circular logic compared to last
	if int32(ts-last.Timestamp) >= 0 {
		// New timestamp?
		if ts == last.Timestamp {
			// Append to existing item
			vq.buffer[len(vq.buffer)-1].Packets = append(last.Packets, packet)
		} else {
			// Append new item
			vq.buffer = append(vq.buffer, newItem)
		}
		return
	}

	// Rare case: Out of order packet. Find clear place to insert.
	// We use simple iteration or binary search. Given it's rare, iteration is fine if small buffer.
	// But let's use Sort for correctness if we just append? No, that's expensive.
	// Let's find index.
	for i := len(vq.buffer) - 1; i >= 0; i-- {
		existing := vq.buffer[i]
		if existing.Timestamp == ts {
			vq.buffer[i].Packets = append(existing.Packets, packet)
			return
		}
		if int32(ts-existing.Timestamp) > 0 {
			// Insert after i
			// buffer = [ ... i, NEW, i+1 ... ]
			tail := append([]QueueItem{newItem}, vq.buffer[i+1:]...)
			vq.buffer = append(vq.buffer[:i+1], tail...)
			return
		}
	}
	// If we get here, it's the oldest packet
	vq.buffer = append([]QueueItem{newItem}, vq.buffer...)
}

// PopUntil returns all packets with timestamp <= targetTS.
// This implements "Loose Synchronization".
func (vq *VideoQueue) PopUntil(targetTS uint32) []*rtp.Packet {
	vq.mu.Lock()
	defer vq.mu.Unlock()

	var result []*rtp.Packet
	cutIndex := -1

	for i, item := range vq.buffer {
		// Check if item.Timestamp <= targetTS (handling rollover)
		// We use signed difference: targetTS - item.Timestamp >= 0
		if int32(targetTS-item.Timestamp) >= 0 {
			result = append(result, item.Packets...)
			cutIndex = i
		} else {
			// Reached a packet strictly newer than targetTS
			// Since buffer is sorted, we can stop early
			break
		}
	}

	if cutIndex >= 0 {
		// Remove returned items from buffer
		// optimization: avoid memory leak by nil-ing out pointers if needed,
		// but for slice of structs containing slices, simple slice trick is fine
		vq.buffer = vq.buffer[cutIndex+1:]
	}

	return result
}

// PopFirst returns the oldest packet in the queue regardless of timestamp.
// Used to establish the initial baseline.
func (vq *VideoQueue) PopFirst() []*rtp.Packet {
	vq.mu.Lock()
	defer vq.mu.Unlock()

	if len(vq.buffer) == 0 {
		return nil
	}

	item := vq.buffer[0]
	vq.buffer = vq.buffer[1:]
	return item.Packets
}

// Prune removes extremely old packets to prevent memory leaks if synchronization fails.
func (vq *VideoQueue) Prune(olderThan uint32) {
	vq.mu.Lock()
	defer vq.mu.Unlock()

	cutIndex := -1
	for i, item := range vq.buffer {
		if int32(olderThan-item.Timestamp) > 0 { // olderThan > item.Timestamp
			cutIndex = i
		} else {
			break
		}
	}

	if cutIndex >= 0 {
		vq.buffer = vq.buffer[cutIndex+1:]
	}
}
