package pipeline

import (
	"sync"

	"github.com/pion/rtp"
)

// VideoQueue buffers video packets to account for AI processing delay.
// It supports frame fragmentation (multiple packets per timestamp).
type VideoQueue struct {
	mu sync.RWMutex
	// map[Timestamp] -> Slice of Packets (Fragmentation support)
	buffer map[uint32][]*rtp.Packet
}

// NewVideoQueue creates a new initialized VideoQueue.
func NewVideoQueue() *VideoQueue {
	return &VideoQueue{
		buffer: make(map[uint32][]*rtp.Packet),
	}
}

// Push adds a packet to the queue.
func (vq *VideoQueue) Push(packet *rtp.Packet) {
	vq.mu.Lock()
	defer vq.mu.Unlock()

	ts := packet.Timestamp
	// Append to slice (handles fragmentation)
	vq.buffer[ts] = append(vq.buffer[ts], packet)
}

// Pop returns all packets associated with the given timestamp and removes them from the queue.
// Returns nil if no packets are found.
func (vq *VideoQueue) Pop(timestamp uint32) []*rtp.Packet {
	vq.mu.Lock()
	defer vq.mu.Unlock()

	packets, exists := vq.buffer[timestamp]
	if !exists {
		return nil
	}

	delete(vq.buffer, timestamp)
	return packets
}

// Prune removes packets older than the given timestamp.
// Note: This implementation assumes simple comparison.
// Wrap-around logic is omitted for MVP but critical for production long-running sessions.
func (vq *VideoQueue) Prune(olderThan uint32) {
	vq.mu.Lock()
	defer vq.mu.Unlock()

	for ts := range vq.buffer {
		// Simple comparison (beware of wrap-around in real RTCP logic)
		if ts < olderThan {
			delete(vq.buffer, ts)
		}
	}
}
