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

// AudioSender defines the capability to send audio data to an external service.
type AudioSender interface {
	Send(data []byte) error
	Close() error
}

// GRPCSender implements AudioSender using the VoiceService gRPC stream.
type GRPCSender struct {
	conn       *grpc.ClientConn
	stream     pb.VoiceService_ConvertStreamClient
	sampleRate int32
	channels   int32
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
func (s *GRPCSender) Send(data []byte) error {
	req := &pb.AudioChunk{
		Pcm:        data,
		SampleRate: s.sampleRate,
		Channels:   s.channels,
	}

	return s.stream.Send(req)
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

// StartPipelinePump reads PCM data from the track and sends it to the gRPC stream.
func StartPipelinePump(ctx context.Context, track pipeline.Transcoder, sender AudioSender) {
	pcmChan := track.GetPCMChannel()

	for {
		select {
		case <-ctx.Done():
			return // Stop working when context is cancelled
		case pcmData, ok := <-pcmChan:
			if !ok {
				return // Channel closed
			}

			// Send to gRPC stream
			if err := sender.Send(pcmData); err != nil {
				return
			}
		}
	}
}
