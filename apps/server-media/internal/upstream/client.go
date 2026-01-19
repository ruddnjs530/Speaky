package upstream

import (
	"context"
	"fmt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "mediaserver/proto"

	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/audio"
)

// AudioSender defines the capability to send audio data to an external service.
type AudioSender interface {
	Send(data []byte) error
	Close() error
}

// GRPCSender implements AudioSender using the VoiceService gRPC stream.
type GRPCSender struct {
	conn   *grpc.ClientConn
	stream pb.VoiceService_ConvertStreamClient
}

// NewGRPCSender creates a connection to the AI Server and initializes the stream.
func NewGRPCSender(address string) (*GRPCSender, error) {
	// Establish a gRPC connection
	// TODO: Update credentials for production security (e.g., use TLS/SSL).
	conn, err := grpc.NewClient(address,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to grpc server: %w", err)
	}

	// Initialize the VoiceService client.
	client := pb.NewVoiceServiceClient(conn)

	// Open a bidirectional stream for audio conversion.
	// TODO: Consider using a context with timeout or cancellation for robust stream management.
	stream, err := client.ConvertStream(context.Background())
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to create stream: %w", err)
	}

	return &GRPCSender{
		conn:   conn,
		stream: stream,
	}, nil
}

// Send constructs an AudioChunk and sends it via the gRPC stream.
func (s *GRPCSender) Send(data []byte) error {
	req := &pb.AudioChunk{
		Pcm:        data,
		SampleRate: int32(audio.TargetSampleRate), // 16000
		Channels:   int32(audio.DefaultChannels),  // 1
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
