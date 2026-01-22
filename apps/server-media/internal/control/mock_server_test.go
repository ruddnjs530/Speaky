package control_test

import (
	"net"
	"testing"

	pb "mediaserver/proto"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type mockVoiceServer struct {
	pb.UnimplementedVoiceServiceServer
}

func (s *mockVoiceServer) ConvertStream(stream pb.VoiceService_ConvertStreamServer) error {
	// Just read until closed
	for {
		_, err := stream.Recv()
		if err != nil {
			return err
		}
	}
}

// startMockVoiceServer starts a gRPC server and returns its address and a cleanup function.
func startMockVoiceServer(t *testing.T) (string, func()) {
	lis, err := net.Listen("tcp", "127.0.0.1:0") // Random port
	require.NoError(t, err)

	s := grpc.NewServer()
	pb.RegisterVoiceServiceServer(s, &mockVoiceServer{})
	reflection.Register(s)

	go s.Serve(lis)

	return lis.Addr().String(), func() {
		s.Stop()
	}
}
