package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	pb "mediaserver/proto"
)

// Config
const (
	gRPCAddr = "localhost:8081"
	httpPort = "9090"
)

func main() {
	// 1. Connect to gRPC Server
	conn, err := grpc.NewClient(gRPCAddr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()
	client := pb.NewMediaControlServiceClient(conn)

	// 2. Setup HTTP Handlers
	http.Handle("/", http.FileServer(http.Dir("./cmd/e2e-harness/public")))

	http.HandleFunc("/api/join", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Read Request
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read body", http.StatusBadRequest)
			return
		}

		var req struct {
			RoomID   string `json:"roomId"`
			UserID   string `json:"userId"`
			SDPOffer string `json:"sdpOffer"`
		}
		if err := json.Unmarshal(body, &req); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		// Create Room if needed (for simplicity, we assume room exists or auto-create)
		// But in our server implementation, Join calls "GetOrCreateRoom".
		// Actually, server `JoinRoom` calls `manager.Join`, which expects room to EXIST (JoinRoom logic usually requires prior Create).
		// Wait, `MediaServiceServer.JoinRoom` delegates to `manager.Join`.
		// `manager.Join` checks existence generally.
		// Let's call CreateRoom first just in case to be safe!
		_, err = client.CreateRoom(context.Background(), &pb.CreateRoomRequest{
			HostId: req.UserID, // Use UserID as HostID so the creator is the host
			RoomId: req.RoomID, // Use explicit RoomID
		})
		if err != nil {
			log.Printf("CreateRoom warning (might exist): %v", err)
		}

		// Call gRPC JoinRoom
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second) // 10s for ICE gathering
		defer cancel()

		resp, err := client.JoinRoom(ctx, &pb.JoinRoomRequest{
			RoomId:   req.RoomID,
			UserId:   req.UserID,
			SdpOffer: req.SDPOffer,
		})
		if err != nil {
			log.Printf("JoinRoom failed: %v", err)
			http.Error(w, fmt.Sprintf("JoinRoom failed: %v", err), http.StatusInternalServerError)
			return
		}

		// Return Answer
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"sdpAnswer": resp.SdpAnswer,
		})
	})

	http.HandleFunc("/api/renegotiate", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Read Request
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "Failed to read body", http.StatusBadRequest)
			return
		}

		var req struct {
			RoomID   string `json:"roomId"`
			UserID   string `json:"userId"`
			SDPOffer string `json:"sdpOffer"`
		}
		if err := json.Unmarshal(body, &req); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		// Call gRPC Renegotiate
		resp, err := client.Renegotiate(context.Background(), &pb.RenegotiateRequest{
			RoomId:   req.RoomID,
			UserId:   req.UserID,
			SdpOffer: req.SDPOffer,
		})
		if err != nil {
			log.Printf("Renegotiate failed: %v", err)
			http.Error(w, fmt.Sprintf("Renegotiate failed: %v", err), http.StatusInternalServerError)
			return
		}

		// Return Answer
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"sdpAnswer": resp.SdpAnswer,
		})
	})

	http.HandleFunc("/api/candidate", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			RoomID        string `json:"roomId"`
			UserID        string `json:"userId"`
			Candidate     string `json:"candidate"`
			SdpMid        string `json:"sdpMid"`
			SdpMLineIndex int    `json:"sdpMLineIndex"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		_, err := client.SubmitIceCandidate(context.Background(), &pb.SubmitIceCandidateRequest{
			RoomId:        req.RoomID,
			UserId:        req.UserID,
			Candidate:     req.Candidate,
			SdpMid:        req.SdpMid,
			SdpMLineIndex: int32(req.SdpMLineIndex),
		})

		if err != nil {
			log.Printf("SubmitIceCandidate error: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
	})

	// 3. Start Server
	log.Printf("Harness listening on http://localhost:%s", httpPort)
	log.Printf("Serving ./public directory...")
	if err := http.ListenAndServe(":"+httpPort, nil); err != nil {
		log.Fatal(err)
	}
}
