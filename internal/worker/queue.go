package worker

import (
	"container/heap"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// PriorityQueue implements a priority queue for jobs
type PriorityQueue struct {
	items    []*Job
	mu       sync.RWMutex
	maxSize  int
	enqueued int64
	dequeued int64
}

// NewPriorityQueue creates a new priority queue
func NewPriorityQueue(maxSize int) *PriorityQueue {
	pq := &PriorityQueue{
		items:    make([]*Job, 0),
		maxSize:  maxSize,
		enqueued: 0,
		dequeued: 0,
	}
	heap.Init(pq)
	return pq
}

// Len returns the number of items in the queue (required by heap.Interface)
func (pq *PriorityQueue) Len() int {
	return len(pq.items)
}

// Less compares two items (required by heap.Interface)
// Higher priority = processed first
func (pq *PriorityQueue) Less(i, j int) bool {
	// First compare by priority (higher = better)
	if pq.items[i].Priority != pq.items[j].Priority {
		return pq.items[i].Priority > pq.items[j].Priority
	}
	// If same priority, FIFO (first in, first out)
	return pq.items[i].SubmittedAt.Before(pq.items[j].SubmittedAt)
}

// Swap swaps two items (required by heap.Interface)
func (pq *PriorityQueue) Swap(i, j int) {
	pq.items[i], pq.items[j] = pq.items[j], pq.items[i]
}

// Push adds an item to the queue (required by heap.Interface)
func (pq *PriorityQueue) Push(x interface{}) {
	job := x.(*Job)
	pq.items = append(pq.items, job)
}

// Pop removes and returns the highest priority item (required by heap.Interface)
func (pq *PriorityQueue) Pop() interface{} {
	old := pq.items
	n := len(old)
	job := old[n-1]
	pq.items = old[0 : n-1]
	return job
}

// Enqueue adds a job to the priority queue
func (pq *PriorityQueue) Enqueue(job *Job) error {
	pq.mu.Lock()
	defer pq.mu.Unlock()

	// Check if queue is full
	if len(pq.items) >= pq.maxSize {
		return ErrQueueFull
	}

	// Add to heap
	heap.Push(pq, job)
	pq.enqueued++

	utils.Debug("Job %s enqueued (priority: %d, queue size: %d)",
		job.ID, job.Priority, len(pq.items))

	return nil
}

// Dequeue removes and returns the highest priority job
func (pq *PriorityQueue) Dequeue() (*Job, error) {
	pq.mu.Lock()
	defer pq.mu.Unlock()

	if len(pq.items) == 0 {
		return nil, ErrQueueEmpty
	}

	// Pop from heap
	job := heap.Pop(pq).(*Job)
	pq.dequeued++

	utils.Debug("Job %s dequeued (priority: %d, queue size: %d)",
		job.ID, job.Priority, len(pq.items))

	return job, nil
}

// Peek returns the highest priority job without removing it
func (pq *PriorityQueue) Peek() (*Job, error) {
	pq.mu.RLock()
	defer pq.mu.RUnlock()

	if len(pq.items) == 0 {
		return nil, ErrQueueEmpty
	}

	return pq.items[0], nil
}

// Size returns the current number of items in the queue
func (pq *PriorityQueue) Size() int {
	pq.mu.RLock()
	defer pq.mu.RUnlock()
	return len(pq.items)
}

// IsFull returns true if the queue is full
func (pq *PriorityQueue) IsFull() bool {
	pq.mu.RLock()
	defer pq.mu.RUnlock()
	return len(pq.items) >= pq.maxSize
}

// IsEmpty returns true if the queue is empty
func (pq *PriorityQueue) IsEmpty() bool {
	pq.mu.RLock()
	defer pq.mu.RUnlock()
	return len(pq.items) == 0
}

// Clear removes all items from the queue
func (pq *PriorityQueue) Clear() {
	pq.mu.Lock()
	defer pq.mu.Unlock()
	pq.items = make([]*Job, 0)
	heap.Init(pq)
}

// GetStats returns queue statistics
func (pq *PriorityQueue) GetStats() map[string]interface{} {
	pq.mu.RLock()
	defer pq.mu.RUnlock()

	usage := float64(len(pq.items)) / float64(pq.maxSize) * 100

	return map[string]interface{}{
		"current_size":   len(pq.items),
		"max_size":       pq.maxSize,
		"usage_percent":  usage,
		"total_enqueued": pq.enqueued,
		"total_dequeued": pq.dequeued,
		"is_full":        len(pq.items) >= pq.maxSize,
		"is_empty":       len(pq.items) == 0,
	}
}

// QueueManager manages multiple priority queues
type QueueManager struct {
	queues map[string]*PriorityQueue
	mu     sync.RWMutex
}

// NewQueueManager creates a new queue manager
func NewQueueManager() *QueueManager {
	return &QueueManager{
		queues: make(map[string]*PriorityQueue),
	}
}

// CreateQueue creates a new queue with the given name
func (qm *QueueManager) CreateQueue(name string, maxSize int) error {
	qm.mu.Lock()
	defer qm.mu.Unlock()

	if _, exists := qm.queues[name]; exists {
		return ErrQueueExists
	}

	qm.queues[name] = NewPriorityQueue(maxSize)
	utils.Info("Created queue: %s (max size: %d)", name, maxSize)
	return nil
}

// GetQueue returns a queue by name
func (qm *QueueManager) GetQueue(name string) (*PriorityQueue, error) {
	qm.mu.RLock()
	defer qm.mu.RUnlock()

	queue, exists := qm.queues[name]
	if !exists {
		return nil, ErrQueueNotFound
	}

	return queue, nil
}

// DeleteQueue removes a queue
func (qm *QueueManager) DeleteQueue(name string) error {
	qm.mu.Lock()
	defer qm.mu.Unlock()

	if _, exists := qm.queues[name]; !exists {
		return ErrQueueNotFound
	}

	delete(qm.queues, name)
	utils.Info("Deleted queue: %s", name)
	return nil
}

// ListQueues returns all queue names
func (qm *QueueManager) ListQueues() []string {
	qm.mu.RLock()
	defer qm.mu.RUnlock()

	names := make([]string, 0, len(qm.queues))
	for name := range qm.queues {
		names = append(names, name)
	}
	return names
}

// GetAllStats returns statistics for all queues
func (qm *QueueManager) GetAllStats() map[string]interface{} {
	qm.mu.RLock()
	defer qm.mu.RUnlock()

	stats := make(map[string]interface{})
	for name, queue := range qm.queues {
		stats[name] = queue.GetStats()
	}
	return stats
}

// Errors
var (
	ErrQueueFull     = &QueueError{Message: "queue is full"}
	ErrQueueEmpty    = &QueueError{Message: "queue is empty"}
	ErrQueueExists   = &QueueError{Message: "queue already exists"}
	ErrQueueNotFound = &QueueError{Message: "queue not found"}
)

// QueueError represents a queue error
type QueueError struct {
	Message string
}

func (e *QueueError) Error() string {
	return e.Message
}

// WaitingQueue implements a simple FIFO queue with waiting mechanism
type WaitingQueue struct {
	items    []*Job
	mu       sync.Mutex
	notEmpty *sync.Cond
	maxSize  int
}

// NewWaitingQueue creates a new waiting queue
func NewWaitingQueue(maxSize int) *WaitingQueue {
	wq := &WaitingQueue{
		items:   make([]*Job, 0),
		maxSize: maxSize,
	}
	wq.notEmpty = sync.NewCond(&wq.mu)
	return wq
}

// Enqueue adds a job to the queue
func (wq *WaitingQueue) Enqueue(job *Job) error {
	wq.mu.Lock()
	defer wq.mu.Unlock()

	if len(wq.items) >= wq.maxSize {
		return ErrQueueFull
	}

	wq.items = append(wq.items, job)
	wq.notEmpty.Signal() // Wake up waiting dequeue
	return nil
}

// Dequeue removes and returns a job, blocks if empty
func (wq *WaitingQueue) Dequeue() *Job {
	wq.mu.Lock()
	defer wq.mu.Unlock()

	// Wait while queue is empty
	for len(wq.items) == 0 {
		wq.notEmpty.Wait()
	}

	job := wq.items[0]
	wq.items = wq.items[1:]
	return job
}

// DequeueWithTimeout dequeues with a timeout
func (wq *WaitingQueue) DequeueWithTimeout(timeout time.Duration) (*Job, error) {
	done := make(chan *Job, 1)

	go func() {
		done <- wq.Dequeue()
	}()

	select {
	case job := <-done:
		return job, nil
	case <-time.After(timeout):
		return nil, ErrQueueEmpty
	}
}

// Size returns the current queue size
func (wq *WaitingQueue) Size() int {
	wq.mu.Lock()
	defer wq.mu.Unlock()
	return len(wq.items)
}

// CircularBuffer implements a ring buffer for recent jobs
type CircularBuffer struct {
	items    []*Job
	head     int
	tail     int
	size     int
	capacity int
	mu       sync.RWMutex
}

// NewCircularBuffer creates a new circular buffer
func NewCircularBuffer(capacity int) *CircularBuffer {
	return &CircularBuffer{
		items:    make([]*Job, capacity),
		head:     0,
		tail:     0,
		size:     0,
		capacity: capacity,
	}
}

// Push adds an item to the buffer
func (cb *CircularBuffer) Push(job *Job) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.items[cb.tail] = job
	cb.tail = (cb.tail + 1) % cb.capacity

	if cb.size < cb.capacity {
		cb.size++
	} else {
		cb.head = (cb.head + 1) % cb.capacity
	}
}

// GetRecent returns the N most recent jobs
func (cb *CircularBuffer) GetRecent(n int) []*Job {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	if n > cb.size {
		n = cb.size
	}

	recent := make([]*Job, 0, n)
	pos := cb.tail - 1
	if pos < 0 {
		pos = cb.capacity - 1
	}

	for i := 0; i < n; i++ {
		if cb.items[pos] != nil {
			recent = append(recent, cb.items[pos])
		}
		pos--
		if pos < 0 {
			pos = cb.capacity - 1
		}
	}

	return recent
}

// Size returns the current number of items
func (cb *CircularBuffer) Size() int {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.size
}

// Clear removes all items
func (cb *CircularBuffer) Clear() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.items = make([]*Job, cb.capacity)
	cb.head = 0
	cb.tail = 0
	cb.size = 0
}
