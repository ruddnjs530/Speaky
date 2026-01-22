package webrtc_test

import (
	"testing"

	"github.com/pion/webrtc/v4"
	"github.com/stretchr/testify/assert"
	"lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/config"
	internalWebrtc "lab.ssafy.com/s14-webmobile1-sub1/S14P11B103/apps/server-media/internal/webrtc"
)

func TestReceiver_Connect(t *testing.T) {
	// Create required dependencies
	api := webrtc.NewAPI()
	cfg := &config.Config{
		STUNServer: "stun:stun.l.google.com:19302",
	}
	receiver := internalWebrtc.NewReceiver(api, cfg)

	config := webrtc.Configuration{}
	clientPC, err := webrtc.NewPeerConnection(config)
	assert.NoError(t, err)
	defer clientPC.Close()

	_, err = clientPC.AddTransceiverFromKind(webrtc.RTPCodecTypeAudio)
	assert.NoError(t, err)

	offer, err := clientPC.CreateOffer(nil)
	assert.NoError(t, err)

	err = clientPC.SetLocalDescription(offer)
	assert.NoError(t, err)

	answerSDP, err := receiver.Connect(offer.SDP)

	assert.NoError(t, err, "Connect should not return error")
	assert.NotEmpty(t, answerSDP, "Answer SDP should not be empty")

	err = receiver.Close()
	assert.NoError(t, err)
}

func TestReceiver_Connect_InvalidSDP(t *testing.T) {
	api := webrtc.NewAPI()
	cfg := &config.Config{}
	receiver := internalWebrtc.NewReceiver(api, cfg)

	invalidSDP := "This is an invalid SDP string."

	answerSDP, err := receiver.Connect(invalidSDP)

	assert.Error(t, err, "Should fail with invalid SDP")
	assert.Empty(t, answerSDP, "Answer should be empty on error")
}
