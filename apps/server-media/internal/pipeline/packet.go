package pipeline

import "time"

// RTPPacket represents a media packet flowing through the pipeline.
// It carries the raw payload and metadata for synchronization.
type RTPPacket struct {
	Data        []byte
	ArrivalTime time.Time // Server Monotonic Clock at Ingress
}
