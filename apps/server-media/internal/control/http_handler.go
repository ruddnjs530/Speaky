package control

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/media"
)

// HTTPHandler handles HTTP requests for E2E testing.
type HTTPHandler struct {
	manager *media.RoomManager
}

// NewHTTPHandler creates a new HTTPHandler.
func NewHTTPHandler(manager *media.RoomManager) *HTTPHandler {
	return &HTTPHandler{
		manager: manager,
	}
}

// JoinRequest represents the JSON payload for /join endpoint.
type JoinRequest struct {
	RoomID string `json:"room_id"`
	UserID string `json:"user_id"`
	SDP    string `json:"sdp"`
	Role   string `json:"role"` // "host" or "guest"
}

// JoinResponse represents the JSON response for /join endpoint.
type JoinResponse struct {
	SDP   string `json:"sdp,omitempty"`
	Error string `json:"error,omitempty"`
}

// ServeHTTP implements the http.Handler interface.
func (h *HTTPHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Enable CORS for localhost testing
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.URL.Path == "/join" && r.Method == "POST" {
		h.handleJoin(w, r)
		return
	}

	// Serve Static Files (Default)
	// Assumes running from apps/server-media root
	fs := http.FileServer(http.Dir("./static"))
	fs.ServeHTTP(w, r)
}

func (h *HTTPHandler) handleJoin(w http.ResponseWriter, r *http.Request) {
	var req JoinRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	slog.Info("HTTP Join Request",
		"room_id", req.RoomID,
		"user_id", req.UserID,
		"role", req.Role)

	// Ensure Room exists or create it
	room, err := h.manager.GetRoom(req.RoomID)
	if err != nil {
		// If Host, create the room
		if req.Role == "host" {
			slog.Info("Creating new room", "room_id", req.RoomID)
			room, err = h.manager.CreateRoomWithID(req.RoomID)
			if err != nil {
				h.writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to create room: %v", err))
				return
			}
		} else {
			// Guests cannot create rooms
			h.writeError(w, http.StatusNotFound, "Room not found. Host must join first.")
			return
		}
	}

	var answerSDP string

	if req.Role == "guest" {
		answerSDP, err = room.JoinAsGuest(req.UserID, req.SDP)
	} else {
		answerSDP, err = room.Join(req.UserID, req.SDP)
	}

	if err != nil {
		slog.Error("Join failed", "error", err)
		h.writeError(w, http.StatusInternalServerError, fmt.Sprintf("Join failed: %v", err))
		return
	}

	// Return Answer
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(JoinResponse{SDP: answerSDP})
}

func (h *HTTPHandler) writeError(w http.ResponseWriter, code int, msg string) {
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(JoinResponse{Error: msg})
}
