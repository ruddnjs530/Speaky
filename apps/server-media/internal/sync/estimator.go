package sync

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

// LatencyEstimator provides a smoothed estimate of processing latency.
// It uses an Exponential Moving Average (EMA) filter.
type LatencyEstimator struct {
	mu           sync.RWMutex
	alpha        float64       // Smoothing factor (0.0 < alpha <= 1.0)
	avgLatency   time.Duration // Current smoothed average
	initialValue bool          // True if we haven't received any samples yet
	readyChan    chan struct{} // Closed when first sample arrives
	once         sync.Once     // Ensures channel closed once
}

// NewLatencyEstimator creates an estimator with the given smoothing factor.
// Suggest alpha=0.1 for stability (slow adaptation), 0.5 for responsiveness.
func NewLatencyEstimator(alpha float64) *LatencyEstimator {
	if alpha <= 0 || alpha > 1 {
		alpha = 0.1 // Default safe value
	}
	return &LatencyEstimator{
		alpha:        alpha,
		initialValue: true,
		readyChan:    make(chan struct{}),
	}
}

// Update records a new latency measurement and updates the smoothed average.
func (l *LatencyEstimator) Update(measured time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.initialValue {
		l.avgLatency = measured
		l.initialValue = false
		l.once.Do(func() {
			close(l.readyChan)
		})
		return
	}

	// EMA formula: NewAvg = (Measured * alpha) + (OldAvg * (1 - alpha))
	// Convert to float for calculation to maintain precision
	newAvg := float64(measured)*l.alpha + float64(l.avgLatency)*(1.0-l.alpha)
	l.avgLatency = time.Duration(newAvg)
}

// GetAverage returns the current smoothed latency estimate.
func (l *LatencyEstimator) GetAverage() time.Duration {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.avgLatency
}

// Reset resets the estimator state.
func (l *LatencyEstimator) Reset() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.avgLatency = 0
	l.initialValue = true
	l.once = sync.Once{}
	l.readyChan = make(chan struct{})
}

// WaitReady blocks until the first latency sample is received or ctx is cancelled.
func (l *LatencyEstimator) WaitReady(ctx context.Context) error {
	select {
	case <-l.readyChan:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// LogDebug logs the current state if it deviates significantly or periodically.
func (l *LatencyEstimator) LogDebug(logger *slog.Logger) {
	// Utility for debugging
	val := l.GetAverage()
	logger.Debug("Latency Estimate", "latency_ms", val.Milliseconds())
}
