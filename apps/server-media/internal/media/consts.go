package media

const (
	// PCMBufferSize defines how many PCM chunks can be buffered in the channel.
	// e.g. 50 chunks * 20ms = 1 second buffer.
	PCMBufferSize = 50
)
