package upstream

import (
	"context"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "mediaserver/proto"

	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/pipeline"
)

// AudioSender defines the capability to send audio data to an external service
// and receive processed responses.
type AudioSender interface {
	Send(frame *pipeline.AudioFrame) error
	Receive() (*pipeline.AudioFrame, error)
	Close() error
}

// GRPCSender implements AudioSender using the VoiceService gRPC stream.
type GRPCSender struct {
	conn          *grpc.ClientConn
	stream        pb.VoiceService_ConvertStreamClient
	sampleRate    int32
	channels      int32
	lastTimestamp uint32 // Tracks the last valid timestamp for local generation
}

// NewGRPCSender creates a connection to the AI Server and initializes the stream.
func NewGRPCSender(ctx context.Context, cfg *config.Config) (*GRPCSender, error) {
	// Establish a gRPC connection
	// TODO: Update credentials for production security (e.g., use TLS/SSL).
	conn, err := grpc.NewClient(cfg.AIServerAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to grpc server: %w", err)
	}

	// Initialize the VoiceService client.
	client := pb.NewVoiceServiceClient(conn)

	// Open a bidirectional stream for audio conversion.
	// TODO: Consider using a context with timeout or cancellation for robust stream management.
	stream, err := client.ConvertStream(ctx)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to create stream: %w", err)
	}

	return &GRPCSender{
		conn:       conn,
		stream:     stream,
		sampleRate: int32(cfg.AudioSampleRate),
		channels:   int32(cfg.AudioChannels),
	}, nil
}

// Send constructs an AudioChunk and sends it via the gRPC stream.
func (s *GRPCSender) Send(frame *pipeline.AudioFrame) error {
	req := &pb.AudioChunk{
		Pcm:        frame.Data,
		SampleRate: s.sampleRate,
		Channels:   s.channels,
		Timestamp:  frame.Timestamp,
	}

	return s.stream.Send(req)
}

// Receive reads a processed AudioChunk from the AI server.
func (s *GRPCSender) Receive() (*pipeline.AudioFrame, error) {
	resp, err := s.stream.Recv()
	if err != nil {
		return nil, fmt.Errorf("failed to receive from stream: %w", err)
	}

	ts := resp.Timestamp
	if ts == 0 {
		// If server returns 0, generate timestamp locally based on duration.
		// We assume output is usually 16kHz mono, but we need 48kHz RTP ticks for sync.
		// Ticks = (bytes / 2 / channels) / sampleRate * 48000
		// Simplified: ticks = bytes * 24000 / (sampleRate * channels)

		// Avoid division by zero
		sr := s.sampleRate
		if sr == 0 {
			sr = 16000
		}
		ch := s.channels
		if ch == 0 {
			ch = 1
		}

		durationTicks := uint32(len(resp.Pcm)) * 24000 / uint32(sr*ch)

		// If this is the first packet (lastTimestamp == 0), start at 0 (or random, but 0 is fine for relative)
		// Actually, we want to increment *after* the first packet?
		// No, usually RTP starts at random. But for relative sync, 0 is fine.
		// We need to increment for the *next* packet.
		// But wait, Sync Loop expects timestamps to increase.

		// Strategy: Use current s.lastTimestamp as the timestamp for THIS packet,
		// then increment it for the NEXT packet.
		ts = s.lastTimestamp
		s.lastTimestamp += durationTicks
	} else {
		// Update local tracker if server sends valid TS
		s.lastTimestamp = ts
	}

	return &pipeline.AudioFrame{
		Data:      resp.Pcm,
		Timestamp: ts,
	}, nil
}

// Close terminates the stream and the connection.
func (s *GRPCSender) Close() error {
	// 스트림 닫기 (더 이상 보낼 데이터가 없음을 알림)
	if s.stream != nil {
		s.stream.CloseSend()
	}
	// TCP 연결 종료
	return s.conn.Close()
}
