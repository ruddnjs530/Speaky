package upstream

import (
	"context"
	"fmt"
	"io"

	pb "mediaserver/proto"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
)

// Client manages the gRPC connection to the AI Server.
type Client struct {
	conn   *grpc.ClientConn
	client pb.VoiceServiceClient
	addr   string
}

// NewClient creates a new AI Server client.
// It establishes a gRPC connection to the specified address.
func NewClient(ctx context.Context, addr string) (*Client, error) {
	// Create gRPC connection with insecure credentials (for development)
	// In production, use proper TLS credentials
	conn, err := grpc.NewClient(
		addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrConnectionRefused, err)
	}

	return &Client{
		conn:   conn,
		client: pb.NewVoiceServiceClient(conn),
		addr:   addr,
	}, nil
}

// Close closes the underlying gRPC connection.
func (c *Client) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

// Stream wraps the bidirectional gRPC stream for audio conversion.
type Stream struct {
	stream pb.VoiceService_ConvertStreamClient
}

// NewStream creates a new bidirectional stream for audio conversion.
func (c *Client) NewStream(ctx context.Context) (*Stream, error) {
	stream, err := c.client.ConvertStream(ctx)
	if err != nil {
		// Check if it's a connection error
		if st, ok := status.FromError(err); ok {
			if st.Code() == codes.Unavailable {
				return nil, fmt.Errorf("%w: %v", ErrConnectionRefused, err)
			}
		}
		return nil, fmt.Errorf("failed to create stream: %w", err)
	}

	return &Stream{stream: stream}, nil
}

// Send sends an audio chunk to the AI server.
func (s *Stream) Send(chunk *pb.AudioChunk) error {
	if err := s.stream.Send(chunk); err != nil {
		if err == io.EOF {
			return fmt.Errorf("%w: %v", ErrStreamBroken, err)
		}
		return fmt.Errorf("failed to send audio chunk: %w", err)
	}
	return nil
}

// Recv receives an audio chunk from the AI server.
func (s *Stream) Recv() (*pb.AudioChunk, error) {
	chunk, err := s.stream.Recv()
	if err != nil {
		if err == io.EOF {
			return nil, io.EOF // Normal stream termination
		}
		return nil, fmt.Errorf("%w: %v", ErrStreamBroken, err)
	}
	return chunk, nil
}

// Close closes the stream by sending CloseSend.
func (s *Stream) Close() error {
	return s.stream.CloseSend()
}
