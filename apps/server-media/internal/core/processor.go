package core

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"time"

	"speaky-media/internal/pipeline"
	"speaky-media/internal/transcode"
	"speaky-media/internal/upstream"

	pb "mediaserver/proto"

	"github.com/pion/rtp"
)

// AudioProcessor manages the transcoding and AI processing lifecycle for a single track.
// Processing Flow: RTP -> Opus Decode -> PCM -> AI Server -> PCM -> Opus Encode -> RTP Packetize -> OutQueue
type AudioProcessor struct {
	decoder    *transcode.OpusDecoder
	encoder    *transcode.OpusEncoder
	packetizer *transcode.RTPPacketizer
	aiClient   upstream.VoiceProcessor // Abstracted client
	outQueue   *pipeline.Queue[pipeline.RTPPacket]
	// Map to track Timestamp -> ArrivalTime for latency calculation
	// Key: uint32 (RTP Timestamp), Value: time.Time
	// Note: We use a simple map with lock for now. For production high-throughput, use sharded map or ring buffer.
	tsMap   map[uint32]time.Time
	tsMutex sync.Mutex
}

// NewAudioProcessor creates a new AudioProcessor.
func NewAudioProcessor(aiClient upstream.VoiceProcessor, outQueue *pipeline.Queue[pipeline.RTPPacket]) (*AudioProcessor, error) {
	// Initialize Opus Codecs (48kHz Mono)
	decoder, err := transcode.NewOpusDecoder(48000, 1)
	if err != nil {
		return nil, err
	}

	encoder, err := transcode.NewOpusEncoder(48000, 1)
	if err != nil {
		return nil, err
	}

	// Initialize Packetizer (SSRC will be rewritten by fan-out anyway, but consistent stream needs one)
	// We use an arbitrary SSRC here.
	packetizer := transcode.NewRTPPacketizer(12345, 111, 1200)

	return &AudioProcessor{
		decoder:    decoder,
		encoder:    encoder,
		packetizer: packetizer,
		aiClient:   aiClient,
		outQueue:   outQueue,
		tsMap:      make(map[uint32]time.Time),
	}, nil
}

// Start begins the processing loop. It blocks until context is done or stream fails.
func (p *AudioProcessor) Start(ctx context.Context, input <-chan pipeline.RTPPacket) error {
	// 1. Establish Bi-directional Stream to AI Server
	stream, err := p.aiClient.NewStream(ctx)
	if err != nil {
		return err
	}
	defer stream.Close()

	// 2. Start Response Reader (Async)
	errChan := make(chan error, 1)
	go p.readLoop(ctx, stream, errChan)

	// 3. Start Request Writer (Sync)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-errChan:
			return err
		case pkt, ok := <-input:
			if !ok {
				return nil // Input channel closed
			}
			if err := p.processInputPacket(stream, pkt); err != nil {
				slog.Error("Failed to process input packet", "error", err)
			}
		}
	}
}

// processInputPacket decodes RTP and sends PCM to AI stream
func (p *AudioProcessor) processInputPacket(stream upstream.VoiceStream, pipePkt pipeline.RTPPacket) error {
	// 0. Unmarshal RTP Packet
	pkt := &rtp.Packet{}
	if err := pkt.Unmarshal(pipePkt.Data); err != nil {
		return err
	}

	// 1. Store Arrival Time
	p.tsMutex.Lock()
	p.tsMap[pkt.Timestamp] = pipePkt.ArrivalTime
	p.tsMutex.Unlock()

	// 2. Decode Opus -> PCM
	pcm, err := p.decoder.Decode(pkt.Payload)
	if err != nil {
		return err
	}

	// 3. Convert to Bytes (Little Endian)
	pcmBytes := Int16ToBytes(pcm)

	// 4. Send to AI Server
	chunk := &pb.AudioChunk{
		Pcm:        pcmBytes,
		SampleRate: 48000,
		Channels:   1,
		Timestamp:  pkt.Timestamp,
		// VoiceModelId: 1, // 1: Korone Voice
	}
	return stream.Send(chunk)
}

// readLoop reads processed PCM from AI stream, encodes, and pushes to queue
func (p *AudioProcessor) readLoop(ctx context.Context, stream upstream.VoiceStream, errChan chan<- error) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		// 1. Receive processed PCM
		chunk, err := stream.Recv()
		if err != nil {
			if errors.Is(err, io.EOF) {
				return
			}
			slog.Error("AP: AI Stream Recv Error", "error", err)
			errChan <- err
			return
		}

		// 2. Convert from Bytes
		pcm, err := BytesToInt16(chunk.Pcm)
		if err != nil {
			slog.Error("Failed to convert received PCM bytes", "error", err)
			continue
		}

		// 3. Encode PCM -> Opus
		encoded, err := p.encoder.Encode(pcm)
		if err != nil {
			slog.Error("Failed to encode processed audio", "error", err)
			continue
		}

		// 4. Packetize -> RTP
		packets, err := p.packetizer.Packetize([][]byte{encoded})
		if err != nil {
			slog.Error("Failed to packetize encoded audio", "error", err)
			continue
		}

		// Lookup original arrival time
		p.tsMutex.Lock()
		arrivalTime, ok := p.tsMap[chunk.Timestamp]
		if !ok {
			// Fallback if not found (latency = 0 effectively)
			arrivalTime = time.Now()
		} else {
			// Clean up old entry
			delete(p.tsMap, chunk.Timestamp)
		}
		p.tsMutex.Unlock()

		// 5. Push to OutQueue
		for _, rtpPkt := range packets {
			// CRITICAL: Restore the ORIGINAL Timestamp to match Video stream for Lip-sync.
			// The packetizer generates new 0-based timestamps, which desyncs from the forwarded video.
			// Assumption: 1 PCM Chunk -> 1 RTP Packet (Standard Opus 20ms)
			// If packetizer produced multiple, we'd need to offset, but for 1:1 this is correct.
			rtpPkt.Timestamp = chunk.Timestamp

			// Marshal back to bytes for Generic Queue
			raw, err := rtpPkt.Marshal()
			if err != nil {
				continue
			}

			if err := p.outQueue.Push(pipeline.RTPPacket{
				Data:        raw, // Now contains Original Timestamp
				ArrivalTime: arrivalTime,
			}); err != nil {
				slog.Warn("AP: OutQueue Push Failed", "error", err)
			}
		}
	}
}
