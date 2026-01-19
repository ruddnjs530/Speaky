package audio

import (
	"encoding/binary"
	"fmt"

	"github.com/hraban/opus"
)

// Interface

type Decoder interface {
	// Decode converts an encoded packet to PCM bytes.
	// - input != nil: Decodes normally.
	// - input == nil: Generates PLC audio (Silence).
	Decode(input []byte) ([]byte, error)
}

// Implementation

type OpusDecoder struct {
	dec        *opus.Decoder
	sampleRate int
	channels   int
	pcmBuffer  []int16
}

func NewOpusDecoder(sampleRate, channels int) (*OpusDecoder, error) {
	if sampleRate != DefaultSampleRate {
		return nil, fmt.Errorf("unsupported sample rate: %d (only %dHz supported)", sampleRate, DefaultSampleRate)
	}

	dec, err := opus.NewDecoder(sampleRate, channels)
	if err != nil {
		return nil, fmt.Errorf("failed to create opus decoder: %w", err)
	}

	return &OpusDecoder{
		dec:        dec,
		sampleRate: sampleRate,
		channels:   channels,
		// Calc buffer size
		// e.g. 48000 * 120 / 1000 = 5760 samples
		pcmBuffer: make([]int16, sampleRate*MaxFrameDurationMs/1000),
	}, nil
}

func (d *OpusDecoder) Decode(opusData []byte) ([]byte, error) {
	// PLC (Packet Loss Concealment)
	if len(opusData) == 0 {
		// Calc slience data size
		// e.g. 48000 * 20 / 1000 = 960 samples
		silenceSamples := d.sampleRate * PLCDurationMs / 1000
		return make([]byte, silenceSamples*2), nil
	}

	// Normal Decoding
	n, err := d.dec.Decode(opusData, d.pcmBuffer)
	if err != nil {
		return nil, fmt.Errorf("opus decode failed: %w", err)
	}

	// Int16 -> Bytes (Little Endian)
	outputBytes := make([]byte, n*2)
	for i := range n {
		binary.LittleEndian.PutUint16(outputBytes[i*2:], uint16(d.pcmBuffer[i]))
	}

	return outputBytes, nil
}

var _ Decoder = (*OpusDecoder)(nil)
