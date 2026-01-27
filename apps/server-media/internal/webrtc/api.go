package webrtc

import (
	"fmt"

	"speaky-media/internal/config"

	"github.com/pion/interceptor"
	"github.com/pion/webrtc/v4"
)

// NewAPI creates a configured Pion WebRTC API instance.
// It sets up the MediaEngine (codecs), Interceptors, and SettingEngine (networking).
func NewAPI(cfg *config.Config) (*webrtc.API, error) {
	// 1. MediaEngine: Register codecs (Opus, VP8, H264, etc.)
	// RegisterDefaultCodecs registers all default codecs supported by Pion.
	m := &webrtc.MediaEngine{}
	if err := m.RegisterDefaultCodecs(); err != nil {
		return nil, fmt.Errorf("failed to register default codecs: %w", err)
	}

	// 2. Interceptor: Create registry for WebRTC extensions (RTCP reports, NACK, etc.)
	i := &interceptor.Registry{}
	if err := webrtc.RegisterDefaultInterceptors(m, i); err != nil {
		return nil, fmt.Errorf("failed to register default interceptors: %w", err)
	}

	// 3. SettingEngine: Configure network settings (UDP ports, NAT)
	s := webrtc.SettingEngine{}

	// 3-1. Configure Ephemeral UDP Port Range
	// Restricts UDP ports to the range allowed by the firewall.
	if cfg.WebRTCMinPort > 0 && cfg.WebRTCMaxPort > 0 {
		if err := s.SetEphemeralUDPPortRange(cfg.WebRTCMinPort, cfg.WebRTCMaxPort); err != nil {
			return nil, fmt.Errorf("failed to set UDP port range: %w", err)
		}
	}

	// 3-2. Configure Public IP (NAT 1:1)
	// When the server is behind NAT (e.g., AWS EC2, Docker), includes the public IP
	// in ICE candidates to improve connection success rate.
	if cfg.PublicIP != "" {
		s.SetNAT1To1IPs([]string{cfg.PublicIP}, webrtc.ICECandidateTypeHost)
	}

	// 4. Create API
	// Combine the configured engines to create the final API object.
	api := webrtc.NewAPI(
		webrtc.WithMediaEngine(m),
		webrtc.WithInterceptorRegistry(i),
		webrtc.WithSettingEngine(s),
	)

	return api, nil
}
