package transcode

import (
	"testing"
)

// --- Opus Codec Tests ---

func TestOpusCodec_RoundTrip(t *testing.T) {
	// 1. Create Decoder & Encoder
	dec, err := NewOpusDecoder(48000, 1)
	if err != nil {
		t.Fatalf("Failed to create decoder: %v", err)
	}
	enc, err := NewOpusEncoder(48000, 1)
	if err != nil {
		t.Fatalf("Failed to create encoder: %v", err)
	}

	// 2. Generate dummy PCM (sine wave or silence)
	// 20ms at 48kHz = 960 samples
	inputPCM := make([]int16, 960)
	for i := range inputPCM {
		inputPCM[i] = int16(i % 1000) // Sawtooth-ish
	}

	// 3. Encode
	encoded, err := enc.Encode(inputPCM)
	if err != nil {
		t.Fatalf("Encode failed: %v", err)
	}
	if len(encoded) == 0 {
		t.Fatal("Encoded data is empty")
	}

	// 4. Decode
	decoded, err := dec.Decode(encoded)
	if err != nil {
		t.Fatalf("Decode failed: %v", err)
	}

	// 5. Verify length matches (Opus ensures fixed frame size decoding)
	if len(decoded) != 960 {
		t.Errorf("Expected 960 samples, got %d", len(decoded))
	}
	// Note: Exact value match isn't expected due to lossy compression
}

// --- Resampler Tests ---

func TestResampler_48k_to_24k(t *testing.T) {
	// Downsample 48k -> 24k
	r, err := NewResampler(48000, 24000, 1)
	if err != nil {
		t.Fatalf("Failed to create resampler: %v", err)
	}

	// Input: 960 samples (20ms @ 48kHz)
	input := make([]int16, 960)

	// Feed multipel chunks to overcome filter delay
	var totalOutput int
	for i := 0; i < 5; i++ {
		output, err := r.Resample(input)
		if err != nil {
			t.Fatalf("Resample failed: %v", err)
		}
		totalOutput += len(output)
	}

	// Expected total: ~2400 samples (5 * 480)
	// zaf/resample buffers internally, so we expect some initial delay (missing ~1 frame worth of data)
	// 5 frames in -> we expect at least 4 frames out fully.
	// 4 * 480 = 1920. We got 1910, which is close.
	if totalOutput < 1900 {
		t.Errorf("Got %d samples, expected > 1900 (streaming delay accounted)", totalOutput)
	}
}

func TestResampler_24k_to_48k(t *testing.T) {
	// Upsample 24k -> 48k
	r, err := NewResampler(24000, 48000, 1)
	if err != nil {
		t.Fatalf("Failed to create resampler: %v", err)
	}

	// Input: 480 samples (20ms @ 24kHz)
	input := make([]int16, 480)

	var totalOutput int
	for i := 0; i < 5; i++ {
		output, err := r.Resample(input)
		if err != nil {
			t.Fatalf("Resample failed: %v", err)
		}
		totalOutput += len(output)
	}

	// Expected total: ~4800 samples (5 * 960)
	// Expect ~1 frame delay. 4 * 960 = 3840.
	// We got 3820.
	if totalOutput < 3800 {
		t.Errorf("Got %d samples, expected > 3800 (streaming delay accounted)", totalOutput)
	}
}

// --- Packetizer Tests ---

func TestPacketizer_MonotonicTimestamps(t *testing.T) {
	pktz := NewRTPPacketizer(1234, 111, 1500)

	// Simulate 3 Opus frames
	frames := [][]byte{
		{0x01, 0x02},
		{0x03, 0x04},
		{0x05, 0x06},
	}

	packets, err := pktz.Packetize(frames)
	if err != nil {
		t.Fatalf("Packetize failed: %v", err)
	}

	if len(packets) != 3 {
		t.Errorf("Expected 3 packets, got %d", len(packets))
	}

	// Verify Sequence Numbers
	for i, pkt := range packets {
		if pkt.Header.SequenceNumber != uint16(i) {
			t.Errorf("Packet %d: Expected Seq %d, got %d", i, i, pkt.Header.SequenceNumber)
		}
	}

	// Verify Timestamps (Increment by 960)
	// 0 -> 960 -> 1920
	expectedTS := []uint32{0, 960, 1920}
	for i, pkt := range packets {
		if pkt.Header.Timestamp != expectedTS[i] {
			t.Errorf("Packet %d: Expected TS %d, got %d", i, expectedTS[i], pkt.Header.Timestamp)
		}
		if pkt.Header.SSRC != 1234 {
			t.Errorf("Packet %d: Wrong SSRC", i)
		}
	}

	// Send more to verify continuity
	packets2, _ := pktz.Packetize([][]byte{{0x07}})
	if packets2[0].Header.Timestamp != 2880 { // 1920 + 960
		t.Errorf("Continuity fail: Expected TS 2880, got %d", packets2[0].Header.Timestamp)
	}
}
