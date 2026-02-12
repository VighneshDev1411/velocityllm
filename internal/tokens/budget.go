package tokens

import (
	"fmt"
	"sync"
)

// BudgetAllocator manages token budget allocation
type BudgetAllocator struct {
	counter      *TokenCounter
	allocations  map[string]*Allocation
	mu           sync.RWMutex
	defaultRatio *AllocationRatio
}

// Allocation represents a token budget allocation
type Allocation struct {
	RequestID      string
	TotalBudget    int
	SystemTokens   int
	PromptTokens   int
	ResponseTokens int
	ContextTokens  int
	ReserveTokens  int
	Used           int
	mu             sync.RWMutex
}

// AllocationRatio defines token distribution ratios
type AllocationRatio struct {
	System   float64 // System prompt ratio (e.g., 0.05 = 5%)
	Prompt   float64 // User prompt ratio (e.g., 0.30 = 30%)
	Context  float64 // Conversation context ratio (e.g., 0.15 = 15%)
	Response float64 // Response generation ratio (e.g., 0.45 = 45%)
	Reserve  float64 // Safety reserve ratio (e.g., 0.05 = 5%)
}

// NewBudgetAllocator creates a new budget allocator
func NewBudgetAllocator() *BudgetAllocator {
	return &BudgetAllocator{
		counter:     GetGlobalCounter(),
		allocations: make(map[string]*Allocation),
		defaultRatio: &AllocationRatio{
			System:   0.05, // 5% for system prompt
			Prompt:   0.30, // 30% for user prompt
			Context:  0.15, // 15% for conversation history
			Response: 0.45, // 45% for response generation
			Reserve:  0.05, // 5% safety reserve
		},
	}
}

// AllocateBudget creates a token budget allocation
func (ba *BudgetAllocator) AllocateBudget(requestID string, totalTokens int, ratio *AllocationRatio) (*Allocation, error) {
	ba.mu.Lock()
	defer ba.mu.Unlock()

	if _, exists := ba.allocations[requestID]; exists {
		return nil, fmt.Errorf("allocation already exists for request: %s", requestID)
	}

	if ratio == nil {
		ratio = ba.defaultRatio
	}

	// Validate ratios sum to ~1.0
	sum := ratio.System + ratio.Prompt + ratio.Context + ratio.Response + ratio.Reserve
	if sum < 0.99 || sum > 1.01 {
		return nil, fmt.Errorf("allocation ratios must sum to 1.0, got %.2f", sum)
	}

	alloc := &Allocation{
		RequestID:      requestID,
		TotalBudget:    totalTokens,
		SystemTokens:   int(float64(totalTokens) * ratio.System),
		PromptTokens:   int(float64(totalTokens) * ratio.Prompt),
		ContextTokens:  int(float64(totalTokens) * ratio.Context),
		ResponseTokens: int(float64(totalTokens) * ratio.Response),
		ReserveTokens:  int(float64(totalTokens) * ratio.Reserve),
		Used:           0,
	}

	ba.allocations[requestID] = alloc
	return alloc, nil
}

// GetAllocation retrieves an allocation by request ID
func (ba *BudgetAllocator) GetAllocation(requestID string) (*Allocation, error) {
	ba.mu.RLock()
	defer ba.mu.RUnlock()

	alloc, exists := ba.allocations[requestID]
	if !exists {
		return nil, fmt.Errorf("allocation not found: %s", requestID)
	}

	return alloc, nil
}

// UseTokens marks tokens as used in allocation
func (ba *BudgetAllocator) UseTokens(requestID string, tokens int) error {
	ba.mu.RLock()
	alloc, exists := ba.allocations[requestID]
	ba.mu.RUnlock()

	if !exists {
		return fmt.Errorf("allocation not found: %s", requestID)
	}

	alloc.mu.Lock()
	defer alloc.mu.Unlock()

	if alloc.Used+tokens > alloc.TotalBudget {
		return fmt.Errorf("token budget exceeded: used=%d, requested=%d, budget=%d",
			alloc.Used, tokens, alloc.TotalBudget)
	}

	alloc.Used += tokens
	return nil
}

// RemainingBudget returns remaining tokens in budget
func (ba *BudgetAllocator) RemainingBudget(requestID string) (int, error) {
	ba.mu.RLock()
	alloc, exists := ba.allocations[requestID]
	ba.mu.RUnlock()

	if !exists {
		return 0, fmt.Errorf("allocation not found: %s", requestID)
	}

	alloc.mu.RLock()
	defer alloc.mu.RUnlock()

	remaining := alloc.TotalBudget - alloc.Used
	if remaining < 0 {
		return 0, nil
	}
	return remaining, nil
}

// CanAllocate checks if tokens can be allocated within budget
func (ba *BudgetAllocator) CanAllocate(requestID string, tokens int) (bool, error) {
	remaining, err := ba.RemainingBudget(requestID)
	if err != nil {
		return false, err
	}
	return tokens <= remaining, nil
}

// GetAllocationBreakdown returns detailed allocation breakdown
func (ba *BudgetAllocator) GetAllocationBreakdown(requestID string) (map[string]int, error) {
	ba.mu.RLock()
	alloc, exists := ba.allocations[requestID]
	ba.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("allocation not found: %s", requestID)
	}

	alloc.mu.RLock()
	defer alloc.mu.RUnlock()

	return map[string]int{
		"total":     alloc.TotalBudget,
		"system":    alloc.SystemTokens,
		"prompt":    alloc.PromptTokens,
		"context":   alloc.ContextTokens,
		"response":  alloc.ResponseTokens,
		"reserve":   alloc.ReserveTokens,
		"used":      alloc.Used,
		"remaining": alloc.TotalBudget - alloc.Used,
	}, nil
}

// OptimizeAllocation adjusts allocation based on actual usage
func (ba *BudgetAllocator) OptimizeAllocation(requestID string, actualSystemTokens, actualPromptTokens, actualContextTokens int) error {
	ba.mu.RLock()
	alloc, exists := ba.allocations[requestID]
	ba.mu.RUnlock()

	if !exists {
		return fmt.Errorf("allocation not found: %s", requestID)
	}

	alloc.mu.Lock()
	defer alloc.mu.Unlock()

	// Calculate total actual tokens used
	actualUsed := actualSystemTokens + actualPromptTokens + actualContextTokens

	// Redistribute remaining budget to response tokens
	remaining := alloc.TotalBudget - actualUsed
	if remaining > 0 {
		// Give remaining budget to response (minus reserve)
		reserveAmount := int(float64(alloc.TotalBudget) * 0.05)
		alloc.ResponseTokens = remaining - reserveAmount
		alloc.ReserveTokens = reserveAmount
	}

	alloc.Used = actualUsed
	return nil
}

// DeleteAllocation removes an allocation
func (ba *BudgetAllocator) DeleteAllocation(requestID string) error {
	ba.mu.Lock()
	defer ba.mu.Unlock()

	if _, exists := ba.allocations[requestID]; !exists {
		return fmt.Errorf("allocation not found: %s", requestID)
	}

	delete(ba.allocations, requestID)
	return nil
}

// GetAllAllocations returns all active allocations
func (ba *BudgetAllocator) GetAllAllocations() map[string]*Allocation {
	ba.mu.RLock()
	defer ba.mu.RUnlock()

	// Return copy to prevent external modification
	result := make(map[string]*Allocation, len(ba.allocations))
	for k, v := range ba.allocations {
		v.mu.RLock()
		result[k] = &Allocation{
			RequestID:      v.RequestID,
			TotalBudget:    v.TotalBudget,
			SystemTokens:   v.SystemTokens,
			PromptTokens:   v.PromptTokens,
			ContextTokens:  v.ContextTokens,
			ResponseTokens: v.ResponseTokens,
			ReserveTokens:  v.ReserveTokens,
			Used:           v.Used,
		}
		v.mu.RUnlock()
	}
	return result
}

// SetDefaultRatio updates the default allocation ratio
func (ba *BudgetAllocator) SetDefaultRatio(ratio *AllocationRatio) error {
	sum := ratio.System + ratio.Prompt + ratio.Context + ratio.Response + ratio.Reserve
	if sum < 0.99 || sum > 1.01 {
		return fmt.Errorf("allocation ratios must sum to 1.0, got %.2f", sum)
	}

	ba.mu.Lock()
	defer ba.mu.Unlock()

	ba.defaultRatio = ratio
	return nil
}

// GetDefaultRatio returns the current default allocation ratio
func (ba *BudgetAllocator) GetDefaultRatio() *AllocationRatio {
	ba.mu.RLock()
	defer ba.mu.RUnlock()

	return &AllocationRatio{
		System:   ba.defaultRatio.System,
		Prompt:   ba.defaultRatio.Prompt,
		Context:  ba.defaultRatio.Context,
		Response: ba.defaultRatio.Response,
		Reserve:  ba.defaultRatio.Reserve,
	}
}

// Global budget allocator
var globalAllocator *BudgetAllocator
var allocatorOnce sync.Once

// GetGlobalAllocator returns the global budget allocator
func GetGlobalAllocator() *BudgetAllocator {
	allocatorOnce.Do(func() {
		globalAllocator = NewBudgetAllocator()
	})
	return globalAllocator
}
