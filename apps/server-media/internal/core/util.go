package core

import (
	"encoding/binary"
	"fmt"
)

// Int16ToBytes converts a slice of int16 to a slice of bytes (Little Endian).
func Int16ToBytes(samples []int16) []byte {
	bytes := make([]byte, len(samples)*2)
	for i, sample := range samples {
		binary.LittleEndian.PutUint16(bytes[i*2:], uint16(sample))
	}
	return bytes
}

// BytesToInt16 converts a slice of bytes to a slice of int16 (Little Endian).
func BytesToInt16(data []byte) ([]int16, error) {
	if len(data)%2 != 0 {
		return nil, fmt.Errorf("byte slice length expected to be even, got %d", len(data))
	}
	samples := make([]int16, len(data)/2)
	for i := 0; i < len(samples); i++ {
		samples[i] = int16(binary.LittleEndian.Uint16(data[i*2:]))
	}
	return samples, nil
}
