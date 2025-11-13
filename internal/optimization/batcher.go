package optimization

import (
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// RequestBatcher batches similar requests together
type RequestBatcher struct {
	config         BatchConfig
	pendingBatches map[string]*Batch // key: model name
	mu             sync.RWMutex
	stopChan       chan struct{}
	stats          BatcherStats
	statsMu        sync.RWMutex
}

// NewRequestBatcher creates a new request batcher
func NewRequestBatcher(config BatchConfig) *RequestBatcher {
	rb := &RequestBatcher{
		config:         config,
		pendingBatches: make(map[string]*Batch),
		stopChan:       make(chan struct{}),
	}

	// Start batch processing loop
	go rb.processBatchesLoop()

	utils.Info("Request batcher initialized (max batch: %d, wait: %s)",
		config.MaxBatchSize, config.MaxWaitTime)

	return rb
}

// Submit submits a request for batching
func (rb *RequestBatcher) Submit(req *BatchRequest) <-chan BatchResult {
	if !rb.config.Enabled {
		// Batching disabled, process immediately
		resultChan := make(chan BatchResult, 1)
		go rb.processIndividual(req, resultChan)
		return resultChan
	}

	// Create result channel
	req.ResultChan = make(chan BatchResult, 1)

	// Add to pending batch
	rb.addToBatch(req)

	// Update stats
	atomic.AddInt64(&rb.stats.TotalRequests, 1)

	return req.ResultChan
}

// addToBatch adds a request to the appropriate batch
func (rb *RequestBatcher) addToBatch(req *BatchRequest) {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	// Get or create batch for this model
	batch, exists := rb.pendingBatches[req.Model]
	if !exists {
		batch = &Batch{
			ID:        generateBatchID(),
			Requests:  make([]*BatchRequest, 0, rb.config.MaxBatchSize),
			Model:     req.Model,
			CreatedAt: time.Now(),
		}
		rb.pendingBatches[req.Model] = batch
	}

	// Add request to batch
	batch.Requests = append(batch.Requests, req)

	// Check if batch is ready to process
	if rb.shouldProcessBatch(batch) {
		go rb.processBatch(batch)
		delete(rb.pendingBatches, req.Model)
	}
}

// shouldProcessBatch checks if a batch should be processed
func (rb *RequestBatcher) shouldProcessBatch(batch *Batch) bool {
	// Check max batch size
	if len(batch.Requests) >= rb.config.MaxBatchSize {
		return true
	}

	// Check total tokens
	totalTokens := 0
	for _, req := range batch.Requests {
		totalTokens += req.Tokens
	}
	if totalTokens >= rb.config.MaxTokens {
		return true
	}

	// Check wait time
	if time.Since(batch.CreatedAt) >= rb.config.MaxWaitTime {
		return true
	}

	return false
}

// processBatchesLoop periodically checks for batches ready to process
func (rb *RequestBatcher) processBatchesLoop() {
	ticker := time.NewTicker(rb.config.MaxWaitTime / 2)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			rb.checkAndProcessBatches()
		case <-rb.stopChan:
			return
		}
	}
}

// checkAndProcessBatches checks all pending batches and processes ready ones
func (rb *RequestBatcher) checkAndProcessBatches() {
	rb.mu.Lock()

	batchesToProcess := make([]*Batch, 0)
	for model, batch := range rb.pendingBatches {
		if time.Since(batch.CreatedAt) >= rb.config.MaxWaitTime {
			batchesToProcess = append(batchesToProcess, batch)
			delete(rb.pendingBatches, model)
		}
	}

	rb.mu.Unlock()

	// Process batches outside lock
	for _, batch := range batchesToProcess {
		go rb.processBatch(batch)
	}
}

// processBatch processes a batch of requests
func (rb *RequestBatcher) processBatch(batch *Batch) {
	startTime := time.Now()

	utils.Debug("Processing batch %s with %d requests (model: %s)",
		batch.ID, len(batch.Requests), batch.Model)

	// Update stats
	atomic.AddInt64(&rb.stats.TotalBatches, 1)

	// Single request - no batching needed
	if len(batch.Requests) == 1 {
		rb.processIndividual(batch.Requests[0], batch.Requests[0].ResultChan)
		return
	}

	// Create combined prompt
	combinedPrompt := rb.createCombinedPrompt(batch.Requests)

	// Make single API call (simulated)
	response := rb.callLLMAPI(batch.Model, combinedPrompt)

	// Split response and send to individual requests
	rb.splitAndDistributeResponse(batch, response)

	// Calculate cost savings
	individualCost := float64(len(batch.Requests)) * 0.01 // $0.01 per request
	batchCost := 0.005                                    // $0.005 for batch
	savings := individualCost - batchCost

	// Update stats
	rb.statsMu.Lock()
	rb.stats.TotalCost += batchCost
	rb.stats.CostSavings += savings
	totalCost := rb.stats.TotalCost
	totalSavings := rb.stats.CostSavings
	rb.stats.AvgBatchSize = float64(rb.stats.TotalRequests) / float64(rb.stats.TotalBatches)
	if totalCost+totalSavings > 0 {
		rb.stats.SavingsPercentage = (totalSavings / (totalCost + totalSavings)) * 100
	}
	rb.stats.AvgWaitTime = time.Since(startTime) / time.Duration(len(batch.Requests))
	rb.statsMu.Unlock()

	utils.Debug("Batch %s completed in %s (saved $%.4f)",
		batch.ID, time.Since(startTime), savings)
}

// processIndividual processes a single request without batching
func (rb *RequestBatcher) processIndividual(req *BatchRequest, resultChan chan<- BatchResult) {
	response := rb.callLLMAPI(req.Model, req.Prompt)

	result := BatchResult{
		ID:       req.ID,
		Response: response,
		Cost:     0.01, // Individual cost
		Error:    nil,
	}

	resultChan <- result
	close(resultChan)

	// Update stats
	rb.statsMu.Lock()
	rb.stats.TotalCost += result.Cost
	rb.statsMu.Unlock()
}

// createCombinedPrompt creates a combined prompt from multiple requests
func (rb *RequestBatcher) createCombinedPrompt(requests []*BatchRequest) string {
	var builder strings.Builder

	builder.WriteString("Process the following requests separately:\n\n")

	for i, req := range requests {
		builder.WriteString(fmt.Sprintf("Request %d:\n%s\n\n", i+1, req.Prompt))
	}

	builder.WriteString("Provide responses in the format:\n")
	builder.WriteString("Response 1: [your response]\n")
	builder.WriteString("Response 2: [your response]\n")
	builder.WriteString("etc.")

	return builder.String()
}

// splitAndDistributeResponse splits the batch response and distributes to requests
func (rb *RequestBatcher) splitAndDistributeResponse(batch *Batch, response string) {
	// Simple splitting logic (in production, use more sophisticated parsing)
	lines := strings.Split(response, "\n")

	responseMap := make(map[int]string)
	currentIdx := -1
	var currentResponse strings.Builder

	for _, line := range lines {
		// Check if this is a response marker
		if strings.HasPrefix(line, "Response ") {
			// Save previous response
			if currentIdx >= 0 {
				responseMap[currentIdx] = strings.TrimSpace(currentResponse.String())
			}

			// Parse response index
			var idx int
			fmt.Sscanf(line, "Response %d:", &idx)
			currentIdx = idx - 1 // Convert to 0-indexed
			currentResponse.Reset()

			// Get response text after colon
			parts := strings.SplitN(line, ":", 2)
			if len(parts) > 1 {
				currentResponse.WriteString(strings.TrimSpace(parts[1]))
			}
		} else if currentIdx >= 0 {
			currentResponse.WriteString(line)
			currentResponse.WriteString("\n")
		}
	}

	// Save last response
	if currentIdx >= 0 {
		responseMap[currentIdx] = strings.TrimSpace(currentResponse.String())
	}

	// Distribute responses to requests
	batchCost := 0.005 // Total batch cost
	costPerRequest := batchCost / float64(len(batch.Requests))

	for i, req := range batch.Requests {
		resp, exists := responseMap[i]
		if !exists {
			resp = fmt.Sprintf("Response for request %d (batched)", i+1)
		}

		result := BatchResult{
			ID:       req.ID,
			Response: resp,
			Cost:     costPerRequest,
			Error:    nil,
		}

		req.ResultChan <- result
		close(req.ResultChan)
	}
}

// callLLMAPI simulates calling the LLM API
func (rb *RequestBatcher) callLLMAPI(model, prompt string) string {
	// Simulate API call latency
	time.Sleep(150 * time.Millisecond)

	// Check if this is a batch prompt
	if strings.Contains(prompt, "Process the following requests separately") {
		// Generate batch response
		count := strings.Count(prompt, "Request ")
		var builder strings.Builder

		for i := 1; i <= count; i++ {
			builder.WriteString(fmt.Sprintf("Response %d: This is a batched response from %s for request %d.\n", i, model, i))
		}

		return builder.String()
	}

	// Individual response
	return fmt.Sprintf("This is a response from %s to: %s", model, prompt)
}

// GetStats returns batcher statistics
func (rb *RequestBatcher) GetStats() BatcherStats {
	rb.statsMu.RLock()
	defer rb.statsMu.RUnlock()
	return rb.stats
}

// GetPendingBatches returns information about pending batches
func (rb *RequestBatcher) GetPendingBatches() map[string]int {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	result := make(map[string]int)
	for model, batch := range rb.pendingBatches {
		result[model] = len(batch.Requests)
	}

	return result
}

// Close stops the batcher
func (rb *RequestBatcher) Close() {
	close(rb.stopChan)

	// Process remaining batches
	rb.mu.Lock()
	for _, batch := range rb.pendingBatches {
		go rb.processBatch(batch)
	}
	rb.pendingBatches = make(map[string]*Batch)
	rb.mu.Unlock()

	utils.Info("Request batcher closed")
}

// generateBatchID generates a unique batch ID
func generateBatchID() string {
	return fmt.Sprintf("batch-%d", time.Now().UnixNano())
}

// Global request batcher
var globalRequestBatcher *RequestBatcher
var batcherOnce sync.Once

// InitGlobalRequestBatcher initializes the global request batcher
func InitGlobalRequestBatcher(config BatchConfig) {
	batcherOnce.Do(func() {
		globalRequestBatcher = NewRequestBatcher(config)
	})
}

// GetGlobalRequestBatcher returns the global request batcher
func GetGlobalRequestBatcher() *RequestBatcher {
	if globalRequestBatcher == nil {
		InitGlobalRequestBatcher(DefaultBatchConfig())
	}
	return globalRequestBatcher
}
