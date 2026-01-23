package test

import (
	"context"
	"testing"
	"time"

	"github.com/pion/webrtc/v4"
	"github.com/pion/webrtc/v4/pkg/media"
	"github.com/stretchr/testify/require"

	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
	internalMedia "lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/media"
)

// TestE2E_FullPipeline tests the complete flow: Host -> Room -> Guest
// AND ensures that media packets actually flow through.
func TestE2E_FullPipeline(t *testing.T) {
	// 0. Setup Environment
	cfg := &config.Config{
		AIServerAddr:    "localhost:50051",
		AudioSampleRate: 48000,
		AudioChannels:   2,
		// Force local loopback range to avoid firewall issues / easy CI
		WebRTCMinPort: 50000,
		WebRTCMaxPort: 50050,
		// Empty STUN to force Host candidates only (Local)
		STUNServer: "",
	}

	api := webrtc.NewAPI()
	roomManager, err := internalMedia.NewRoomManager(cfg)
	require.NoError(t, err)

	// 1. Create Room
	room, err := roomManager.CreateRoom("initial-host")
	require.NoError(t, err)
	defer room.Close()

	// 2. Setup Host Client (Sender)
	hostPC, err := api.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)
	defer hostPC.Close()

	// [IMPORTANT] Create actual track to write data (Opus)
	audioTrack, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus}, "audio", "pion",
	)
	require.NoError(t, err)

	_, err = hostPC.AddTrack(audioTrack)
	require.NoError(t, err)

	// Host Signaling
	offer, err := hostPC.CreateOffer(nil)
	require.NoError(t, err)

	gatherComplete := webrtc.GatheringCompletePromise(hostPC)
	err = hostPC.SetLocalDescription(offer)
	require.NoError(t, err)
	<-gatherComplete

	// 3. Host Joins Room
	answerSDP, err := room.Join("host-user", hostPC.LocalDescription().SDP)
	require.NoError(t, err)

	err = hostPC.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer,
		SDP:  answerSDP,
	})
	require.NoError(t, err)

	// [IMPORTANT] Start Pumping Data (Host -> Server)
	// This simulates the Host talking
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		ticker := time.NewTicker(20 * time.Millisecond)
		defer ticker.Stop()
		// Dummy Opus-like packet (Silent frame or just junk)
		// Note: The server expects Opus. If it transcodes, it might fail if data is junk.
		// But for simple relay/pipeline check, valid-length junk might work if parser isn't strict.
		// Standard Silent Opus Frame: []byte{0xF8, 0xFF, 0xFE}
		sample := media.Sample{Data: []byte{0xF8, 0xFF, 0xFE}, Duration: 20 * time.Millisecond}

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := audioTrack.WriteSample(sample); err != nil {
					return
				}
			}
		}
	}()

	// 4. Setup Guest Client (Receiver)
	guestPC, err := api.NewPeerConnection(webrtc.Configuration{})
	require.NoError(t, err)
	defer guestPC.Close()

	// [IMPORTANT] Verify Data Reception
	packetReceived := make(chan struct{})
	guestPC.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		t.Logf("Guest received track: %s", track.Kind().String())

		// Must read from track to drain buffer
		go func() {
			buf := make([]byte, 1500)
			for {
				_, _, err := track.Read(buf)
				if err != nil {
					return
				}
				// Signal success on first packet
				// Use select to avoid blocking or panicking on closed channel
				select {
				case <-packetReceived:
					// already closed
				default:
					close(packetReceived)
				}
			}
		}()
	})

	// Guest Signaling (RecvOnly)
	_, err = guestPC.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio, webrtc.RTPTransceiverInit{
		Direction: webrtc.RTPTransceiverDirectionRecvonly,
	})
	require.NoError(t, err)

	guestOffer, err := guestPC.CreateOffer(nil)
	require.NoError(t, err)

	guestGatherComplete := webrtc.GatheringCompletePromise(guestPC)
	err = guestPC.SetLocalDescription(guestOffer)
	require.NoError(t, err)
	<-guestGatherComplete

	// 5. Guest Joins Room
	guestAnswerSDP, err := room.JoinAsGuest("guest-user", guestPC.LocalDescription().SDP)
	require.NoError(t, err)

	err = guestPC.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeAnswer,
		SDP:  guestAnswerSDP,
	})
	require.NoError(t, err)

	// 6. Verify Media Flow
	select {
	case <-packetReceived:
		t.Log("✅ SUCCESS: Media flowed from Host -> Room -> Guest")
	case <-time.After(10 * time.Second):
		t.Fatal("❌ TIMEOUT: Guest connected but received NO media packets (Check AI Server logic or transcoding)")
	}
}
