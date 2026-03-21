package batch

import (
	"sync"

	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

const maxHistory = 100

// Service manages batch completion history
type Service struct {
	history []*types.BatchCompletionResult
	mu      sync.RWMutex
}

var (
	instance *Service
	once     sync.Once
)

// GetService returns the singleton batch service
func GetService() *Service {
	once.Do(func() {
		instance = &Service{
			history: make([]*types.BatchCompletionResult, 0),
		}
		utils.Info("Batch comparison service initialized")
	})
	return instance
}

// SaveRun stores a batch completion run
func (s *Service) SaveRun(result *types.BatchCompletionResult) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.history = append(s.history, result)
	if len(s.history) > maxHistory {
		s.history = s.history[len(s.history)-maxHistory:]
	}
}

// GetHistory returns the most recent batch runs
func (s *Service) GetHistory(limit int) []*types.BatchCompletionResult {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if limit <= 0 || limit > len(s.history) {
		limit = len(s.history)
	}

	// Return newest first
	result := make([]*types.BatchCompletionResult, limit)
	for i := 0; i < limit; i++ {
		result[i] = s.history[len(s.history)-1-i]
	}
	return result
}
