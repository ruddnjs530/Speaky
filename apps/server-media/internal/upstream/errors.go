package upstream

import "errors"

// Sentinel errors for upstream communication
var (
	// ErrConnectionRefused is returned when the AI server connection fails
	ErrConnectionRefused = errors.New("AI server connection refused")

	// ErrStreamBroken is returned when the stream is broken during operation
	ErrStreamBroken = errors.New("stream broken during operation")
)
