package pipeline

// AudioFrame represents a chunk of audio data with its associated RTP metadata.
// This preserves the temporal context needed for A/V synchronization.
type AudioFrame struct {
	// Data is the raw audio samples (PCM or Encoded)
	Data []byte

	// Timestamp is the RTP timestamp associated with this audio chunk.
	// For PCM, this is typically derived from the first packet that contributed to this chunk.
	Timestamp uint32

	// SequenceNumber might be useful later, but Timestamp is critical for Sync.
	// SequenceNumber uint16
}
