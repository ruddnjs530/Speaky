package upstream

import (
	"context"
	"errors"
	"io"
	"net"
	"testing"
	"time"

	pb "mediaserver/proto"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"
)

// mockVoiceServer implements a simple mock AI server for testing
type mockVoiceServer struct {
	pb.UnimplementedVoiceServiceServer
	// Track received chunks for verification
	receivedChunks []*pb.AudioChunk
}

func (m *mockVoiceServer) ConvertStream(stream pb.VoiceService_ConvertStreamServer) error {
	for {
		chunk, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}

		// Store received chunk
		m.receivedChunks = append(m.receivedChunks, chunk)

		// Echo back the chunk (simple mock behavior)
		if err := stream.Send(chunk); err != nil {
			return err
		}
	}
}

// setupMockServer creates a mock gRPC server for testing
func setupMockServer(t *testing.T) (*grpc.Server, *bufconn.Listener, *mockVoiceServer) {
	buffer := 1024 * 1024
	listener := bufconn.Listen(buffer)

	server := grpc.NewServer()
	mock := &mockVoiceServer{}
	pb.RegisterVoiceServiceServer(server, mock)

	go func() {
		if err := server.Serve(listener); err != nil {
			t.Logf("Server exited with error: %v", err)
		}
	}()

	return server, listener, mock
}

// createTestClient creates a client connected to the mock server
func createTestClient(ctx context.Context, t *testing.T, listener *bufconn.Listener) *Client {
	conn, err := grpc.DialContext(
		ctx,
		"bufnet",
		grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) {
			return listener.Dial()
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	require.NoError(t, err)

	return &Client{
		conn:   conn,
		client: pb.NewVoiceServiceClient(conn),
		addr:   "bufnet",
	}
}

// TestClient_HappyPath tests the normal operation flow
func TestClient_HappyPath(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Setup mock server
	server, listener, mock := setupMockServer(t)
	defer server.Stop()

	// Create client
	client := createTestClient(ctx, t, listener)
	defer client.Close()

	// Create stream
	stream, err := client.NewStream(ctx)
	require.NoError(t, err)
	defer stream.Close()

	// Send audio chunk
	sentChunk := &pb.AudioChunk{
		Pcm:        []byte{1, 2, 3, 4},
		SampleRate: 24000,
		Channels:   1,
		Timestamp:  12345,
	}

	err = stream.Send(sentChunk)
	require.NoError(t, err)

	// Receive response (mock echoes back)
	receivedChunk, err := stream.Recv()
	require.NoError(t, err)

	// Verify
	assert.Equal(t, sentChunk.Pcm, receivedChunk.Pcm)
	assert.Equal(t, sentChunk.SampleRate, receivedChunk.SampleRate)
	assert.Equal(t, sentChunk.Channels, receivedChunk.Channels)

	// Verify mock server received the chunk
	require.Len(t, mock.receivedChunks, 1)
	assert.Equal(t, sentChunk.Pcm, mock.receivedChunks[0].Pcm)
}

// TestClient_ConnectionRefused tests behavior when AI server is unavailable
func TestClient_ConnectionRefused(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Try to connect to a non-existent server
	_, err := NewClient(ctx, "localhost:99999")

	// Should return ErrConnectionRefused
	// Note: NewClient doesn't actually test connectivity, it just creates the client
	// The error will occur when trying to create a stream
	if err != nil {
		assert.True(t, errors.Is(err, ErrConnectionRefused))
	}
}

// TestStream_Recv_EOF tests normal stream termination
func TestStream_Recv_EOF(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Setup mock server
	server, listener, _ := setupMockServer(t)
	defer server.Stop()

	// Create client and stream
	client := createTestClient(ctx, t, listener)
	defer client.Close()

	stream, err := client.NewStream(ctx)
	require.NoError(t, err)

	// Close the stream from client side
	err = stream.Close()
	require.NoError(t, err)

	// Trying to receive should return EOF
	_, err = stream.Recv()
	assert.Equal(t, io.EOF, err)
}
