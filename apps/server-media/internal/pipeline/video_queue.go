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
//
// Rollover Handling: Uses signed difference (int32) to correctly handle
// uint32 wraparound per RFC 3550. A packet is considered "older" if the
// signed difference is negative.
//
// Example:
//   - olderThan = 100, packetTS = 4294967000 → diff = -4294966900 (negative, old)
//   - olderThan = 100, packetTS = 200 → diff = 100 (positive, recent)
func (vq *VideoQueue) Prune(olderThan uint32) {
	vq.mu.Lock()
	defer vq.mu.Unlock()

	for ts := range vq.buffer {
		// Signed difference handles rollover correctly
		// Negative diff means packet is older than threshold
		diff := int32(ts - olderThan)
		if diff < 0 {
			delete(vq.buffer, ts)
		}
	}
}
