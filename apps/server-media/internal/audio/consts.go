package audio

// 오디오 처리 관련 상수 정의
const (
	// DefaultSampleRate : 48kHz
	DefaultSampleRate = 48000

	// PLCDurationMs : 패킷 손실 시 대체할 프레임 길이 (20ms)
	PLCDurationMs = 20

	// MaxFrameDurationMs : Opus 버퍼링을 위한 최대 프레임 길이 (120ms)
	MaxFrameDurationMs = 120
)
