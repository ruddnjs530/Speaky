package webrtc

const (
	DefaultSTUNServer = "stun:stun.l.google.com:19302"

	// ReadBufferSize is the size of the buffer for reading RTP packets.
	// 1500 bytes is the typical MTU (Maximum Transmission Unit) size for Ethernet.
	ReadBufferSize = 1500
)
