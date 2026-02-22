package loadtest

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"gorm.io/gorm"
)

type Service struct {
	db          *gorm.DB
	httpClient  *http.Client
	activeTests sync.Map // map[uint]*TestRunner
}

func NewService(db *gorm.DB) *Service {
	return &Service{
		db: db,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// TestRunner manages the execution of a single load test
type TestRunner struct {
	run           *LoadTestRun
	config        *LoadTestConfig
	ctx           context.Context
	cancel        context.CancelFunc
	db            *gorm.DB
	httpClient    *http.Client

	// Counters
	totalRequests    atomic.Int64
	successfulReqs   atomic.Int64
	failedReqs       atomic.Int64
	timeoutReqs      atomic.Int64
	totalTokens      atomic.Int64

	// Latency tracking
	latencies        []float64
	latenciesMutex   sync.Mutex

	// Real-time metrics
	metricsInterval  time.Duration
	startTime        time.Time
}

// CreateLoadTest creates a new load test configuration
func (s *Service) CreateLoadTest(config *LoadTestConfig) error {
	return s.db.Create(config).Error
}

// GetLoadTest retrieves a load test configuration
func (s *Service) GetLoadTest(id uint) (*LoadTestConfig, error) {
	var config LoadTestConfig
	err := s.db.First(&config, id).Error
	return &config, err
}

// ListLoadTests returns all load test configurations
func (s *Service) ListLoadTests(limit int) ([]LoadTestConfig, error) {
	var configs []LoadTestConfig
	err := s.db.Order("created_at DESC").Limit(limit).Find(&configs).Error
	return configs, err
}

// StartLoadTest initiates a load test execution
func (s *Service) StartLoadTest(configID uint) (*LoadTestRun, error) {
	config, err := s.GetLoadTest(configID)
	if err != nil {
		return nil, err
	}

	// Create run record
	run := &LoadTestRun{
		ConfigID:  configID,
		Status:    TestStatusQueued,
	}

	if err := s.db.Create(run).Error; err != nil {
		return nil, err
	}

	// Start test in background
	go s.executeLoadTest(run, config)

	return run, nil
}

// executeLoadTest runs the actual load test
func (s *Service) executeLoadTest(run *LoadTestRun, config *LoadTestConfig) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(config.Duration+30)*time.Second)
	defer cancel()

	runner := &TestRunner{
		run:             run,
		config:          config,
		ctx:             ctx,
		cancel:          cancel,
		db:              s.db,
		httpClient:      s.httpClient,
		latencies:       make([]float64, 0, config.TargetRPS*config.Duration),
		metricsInterval: 1 * time.Second,
		startTime:       time.Now(),
	}

	s.activeTests.Store(run.ID, runner)
	defer s.activeTests.Delete(run.ID)

	// Update status to running
	now := time.Now()
	run.Status = TestStatusRunning
	run.StartedAt = &now
	s.db.Save(run)

	// Start metrics collector
	go runner.collectMetrics()

	// Execute load pattern
	var err error
	switch config.Pattern {
	case LoadPatternConstant:
		err = runner.runConstantLoad()
	case LoadPatternRampUp:
		err = runner.runRampUpLoad()
	case LoadPatternSpike:
		err = runner.runSpikeLoad()
	case LoadPatternWave:
		err = runner.runWaveLoad()
	case LoadPatternBurst:
		err = runner.runBurstLoad()
	default:
		err = fmt.Errorf("unknown load pattern: %s", config.Pattern)
	}

	// Finalize run
	runner.finalizeRun(err)
}

// runConstantLoad maintains a constant RPS
func (r *TestRunner) runConstantLoad() error {
	targetRPS := r.config.TargetRPS
	duration := time.Duration(r.config.Duration) * time.Second
	interval := time.Second / time.Duration(targetRPS)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	deadline := time.Now().Add(duration)

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, r.config.Concurrency)

	for {
		select {
		case <-r.ctx.Done():
			wg.Wait()
			return nil
		case <-ticker.C:
			if time.Now().After(deadline) {
				wg.Wait()
				return nil
			}

			semaphore <- struct{}{}
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer func() { <-semaphore }()
				r.sendRequest()
			}()
		}
	}
}

// runRampUpLoad gradually increases RPS
func (r *TestRunner) runRampUpLoad() error {
	rampTime := time.Duration(r.config.RampUpTime) * time.Second
	if rampTime == 0 {
		rampTime = time.Duration(r.config.Duration/2) * time.Second
	}

	targetRPS := r.config.TargetRPS
	duration := time.Duration(r.config.Duration) * time.Second

	startRPS := float64(targetRPS) * 0.1 // Start at 10% of target
	deadline := time.Now().Add(duration)

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, r.config.Concurrency)

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-r.ctx.Done():
			wg.Wait()
			return nil
		case <-ticker.C:
			if time.Now().After(deadline) {
				wg.Wait()
				return nil
			}

			elapsed := time.Since(r.startTime)
			var currentRPS float64
			if elapsed < rampTime {
				// Ramp up phase
				progress := float64(elapsed) / float64(rampTime)
				currentRPS = startRPS + (float64(targetRPS)-startRPS)*progress
			} else {
				// Steady state
				currentRPS = float64(targetRPS)
			}

			// Send requests based on current RPS
			requestsToSend := int(currentRPS / 10) // ticker is 100ms = 1/10 second
			for i := 0; i < requestsToSend; i++ {
				semaphore <- struct{}{}
				wg.Add(1)
				go func() {
					defer wg.Done()
					defer func() { <-semaphore }()
					r.sendRequest()
				}()
			}
		}
	}
}

// runSpikeLoad creates sudden traffic spikes
func (r *TestRunner) runSpikeLoad() error {
	normalRPS := r.config.TargetRPS / 2
	spikeRPS := r.config.TargetRPS * 3
	duration := time.Duration(r.config.Duration) * time.Second

	deadline := time.Now().Add(duration)
	var wg sync.WaitGroup
	semaphore := make(chan struct{}, r.config.Concurrency*2)

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-r.ctx.Done():
			wg.Wait()
			return nil
		case <-ticker.C:
			if time.Now().After(deadline) {
				wg.Wait()
				return nil
			}

			elapsed := time.Since(r.startTime)

			// Spike every 20 seconds for 5 seconds
			isSpike := int(elapsed.Seconds())%20 < 5

			currentRPS := normalRPS
			if isSpike {
				currentRPS = spikeRPS
			}

			requestsToSend := int(currentRPS / 10)
			for i := 0; i < requestsToSend; i++ {
				semaphore <- struct{}{}
				wg.Add(1)
				go func() {
					defer wg.Done()
					defer func() { <-semaphore }()
					r.sendRequest()
				}()
			}
		}
	}
}

// runWaveLoad creates a sine wave traffic pattern
func (r *TestRunner) runWaveLoad() error {
	avgRPS := float64(r.config.TargetRPS)
	amplitude := avgRPS * 0.5 // Wave amplitude is 50% of average
	period := 30.0            // 30 second wave period

	duration := time.Duration(r.config.Duration) * time.Second
	deadline := time.Now().Add(duration)

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, r.config.Concurrency)

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-r.ctx.Done():
			wg.Wait()
			return nil
		case <-ticker.C:
			if time.Now().After(deadline) {
				wg.Wait()
				return nil
			}

			elapsed := time.Since(r.startTime).Seconds()

			// Sine wave: RPS = avg + amplitude * sin(2π * elapsed / period)
			currentRPS := avgRPS + amplitude*math.Sin(2*math.Pi*elapsed/period)

			requestsToSend := int(currentRPS / 10)
			for i := 0; i < requestsToSend; i++ {
				semaphore <- struct{}{}
				wg.Add(1)
				go func() {
					defer wg.Done()
					defer func() { <-semaphore }()
					r.sendRequest()
				}()
			}
		}
	}
}

// runBurstLoad creates periodic bursts of traffic
func (r *TestRunner) runBurstLoad() error {
	burstRPS := r.config.TargetRPS * 2
	burstDuration := 3 * time.Second
	pauseDuration := 7 * time.Second

	duration := time.Duration(r.config.Duration) * time.Second
	deadline := time.Now().Add(duration)

	var wg sync.WaitGroup
	semaphore := make(chan struct{}, r.config.Concurrency)

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-r.ctx.Done():
			wg.Wait()
			return nil
		case <-ticker.C:
			if time.Now().After(deadline) {
				wg.Wait()
				return nil
			}

			elapsed := time.Since(r.startTime)
			cyclePos := elapsed % (burstDuration + pauseDuration)

			var currentRPS int
			if cyclePos < burstDuration {
				currentRPS = burstRPS
			} else {
				currentRPS = 0 // Pause
			}

			requestsToSend := int(currentRPS / 10)
			for i := 0; i < requestsToSend; i++ {
				semaphore <- struct{}{}
				wg.Add(1)
				go func() {
					defer wg.Done()
					defer func() { <-semaphore }()
					r.sendRequest()
				}()
			}
		}
	}
}

// sendRequest sends a single HTTP request and records metrics
func (r *TestRunner) sendRequest() {
	start := time.Now()
	r.totalRequests.Add(1)

	// Send request (payload will be used in future iterations)
	req, err := http.NewRequestWithContext(r.ctx, "POST", "http://localhost:8080/api/v1/completions", nil)
	if err != nil {
		r.failedReqs.Add(1)
		return
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := r.httpClient.Do(req)
	latency := time.Since(start).Seconds() * 1000 // Convert to ms

	// Record latency
	r.latenciesMutex.Lock()
	r.latencies = append(r.latencies, latency)
	r.latenciesMutex.Unlock()

	if err != nil {
		r.failedReqs.Add(1)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		r.successfulReqs.Add(1)
	} else {
		r.failedReqs.Add(1)
	}
}

// collectMetrics collects real-time metrics during the test
func (r *TestRunner) collectMetrics() {
	ticker := time.NewTicker(r.metricsInterval)
	defer ticker.Stop()

	for {
		select {
		case <-r.ctx.Done():
			return
		case <-ticker.C:
			elapsed := int(time.Since(r.startTime).Seconds())

			r.latenciesMutex.Lock()
			avgLatency := r.calculateAvgLatency()
			p95Latency := r.calculatePercentile(95)
			r.latenciesMutex.Unlock()

			completed := r.successfulReqs.Load()
			failed := r.failedReqs.Load()
			total := completed + failed

			var errorRate float64
			if total > 0 {
				errorRate = float64(failed) / float64(total) * 100
			}

			metric := &LoadTestMetric{
				RunID:          r.run.ID,
				Timestamp:      time.Now(),
				ElapsedSeconds: elapsed,
				CurrentRPS:     float64(total) / float64(elapsed+1),
				CompletedReqs:  completed,
				FailedReqs:     failed,
				AvgLatencyMs:   avgLatency,
				P95LatencyMs:   p95Latency,
				ErrorRate:      errorRate,
			}

			r.db.Create(metric)
		}
	}
}

// calculateAvgLatency calculates average latency
func (r *TestRunner) calculateAvgLatency() float64 {
	if len(r.latencies) == 0 {
		return 0
	}
	sum := 0.0
	for _, l := range r.latencies {
		sum += l
	}
	return sum / float64(len(r.latencies))
}

// calculatePercentile calculates the Nth percentile latency
func (r *TestRunner) calculatePercentile(percentile int) float64 {
	if len(r.latencies) == 0 {
		return 0
	}

	sorted := make([]float64, len(r.latencies))
	copy(sorted, r.latencies)
	sort.Float64s(sorted)

	index := int(float64(percentile)/100.0*float64(len(sorted))) - 1
	if index < 0 {
		index = 0
	}
	if index >= len(sorted) {
		index = len(sorted) - 1
	}

	return sorted[index]
}

// finalizeRun completes the load test and saves final metrics
func (r *TestRunner) finalizeRun(err error) {
	now := time.Now()
	r.run.CompletedAt = &now
	r.run.DurationMs = time.Since(r.startTime).Milliseconds()

	r.run.TotalRequests = r.totalRequests.Load()
	r.run.SuccessfulReqs = r.successfulReqs.Load()
	r.run.FailedReqs = r.failedReqs.Load()
	r.run.TimeoutReqs = r.timeoutReqs.Load()

	r.latenciesMutex.Lock()
	r.run.AvgLatencyMs = r.calculateAvgLatency()
	r.run.P50LatencyMs = r.calculatePercentile(50)
	r.run.P95LatencyMs = r.calculatePercentile(95)
	r.run.P99LatencyMs = r.calculatePercentile(99)

	if len(r.latencies) > 0 {
		sorted := make([]float64, len(r.latencies))
		copy(sorted, r.latencies)
		sort.Float64s(sorted)
		r.run.MinLatencyMs = sorted[0]
		r.run.MaxLatencyMs = sorted[len(sorted)-1]
	}
	r.latenciesMutex.Unlock()

	r.run.ActualRPS = float64(r.run.TotalRequests) / (float64(r.run.DurationMs) / 1000.0)

	if err != nil {
		r.run.Status = TestStatusFailed
		r.run.ErrorMessage = err.Error()
	} else {
		r.run.Status = TestStatusCompleted
	}

	r.db.Save(r.run)
}

// GetTestRun retrieves a load test run
func (s *Service) GetTestRun(id uint) (*LoadTestRun, error) {
	var run LoadTestRun
	err := s.db.Preload("Config").First(&run, id).Error
	return &run, err
}

// ListTestRuns returns recent test runs
func (s *Service) ListTestRuns(limit int) ([]LoadTestRun, error) {
	var runs []LoadTestRun
	err := s.db.Preload("Config").Order("created_at DESC").Limit(limit).Find(&runs).Error
	return runs, err
}

// GetTestMetrics retrieves real-time metrics for a test run
func (s *Service) GetTestMetrics(runID uint) ([]LoadTestMetric, error) {
	var metrics []LoadTestMetric
	err := s.db.Where("run_id = ?", runID).Order("timestamp ASC").Find(&metrics).Error
	return metrics, err
}

// StopLoadTest cancels a running load test
func (s *Service) StopLoadTest(runID uint) error {
	if runner, ok := s.activeTests.Load(runID); ok {
		r := runner.(*TestRunner)
		r.cancel()
		return nil
	}
	return fmt.Errorf("test run not found or not running")
}

// ============================================
// GLOBAL SERVICE SINGLETON
// ============================================

var globalService *Service

func InitGlobalService(db *gorm.DB) {
	globalService = NewService(db)
}

func GetGlobalService() *Service {
	return globalService
}
