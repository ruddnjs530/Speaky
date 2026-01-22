package pipeline

import (
	"testing"
)

// Benchmark to measure allocation reduction from buffer reuse
func BenchmarkOpusEncoder_Encode(b *testing.B) {
	encoder, err := NewOpusEncoder(16000, 1, 0)
	if err != nil {
		b.Fatal(err)
	}
	defer encoder.Close()

	// Create dummy input (16kHz mono, 20ms)
	inputData := make([]byte, 320*2)
	frame := &AudioFrame{
		Data:      inputData,
		Timestamp: 48000,
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := encoder.Encode(frame)
		if err != nil {
			b.Fatal(err)
		}
	}
}
