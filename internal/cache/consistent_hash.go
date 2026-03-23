package cache

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"sort"
	"sync"
)

// HashRing implements consistent hashing for distributing cache keys across nodes.
// Each physical node gets multiple virtual nodes (replicas) on the ring for even distribution.
type HashRing struct {
	mu       sync.RWMutex
	nodes    map[string]bool   // physical node set
	ring     []uint32          // sorted hash values
	hashMap  map[uint32]string // hash → node mapping
	replicas int               // virtual nodes per physical node
}

// NewHashRing creates a consistent hash ring with the given number of virtual replicas per node.
func NewHashRing(replicas int) *HashRing {
	if replicas <= 0 {
		replicas = 150
	}
	return &HashRing{
		nodes:    make(map[string]bool),
		ring:     make([]uint32, 0),
		hashMap:  make(map[uint32]string),
		replicas: replicas,
	}
}

// AddNode adds a physical node to the ring with virtual replicas.
func (h *HashRing) AddNode(node string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.nodes[node] {
		return
	}
	h.nodes[node] = true

	for i := 0; i < h.replicas; i++ {
		hash := h.hash(fmt.Sprintf("%s#%d", node, i))
		h.ring = append(h.ring, hash)
		h.hashMap[hash] = node
	}
	sort.Slice(h.ring, func(i, j int) bool { return h.ring[i] < h.ring[j] })
}

// RemoveNode removes a physical node and all its virtual replicas from the ring.
func (h *HashRing) RemoveNode(node string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if !h.nodes[node] {
		return
	}
	delete(h.nodes, node)

	newRing := make([]uint32, 0, len(h.ring)-h.replicas)
	for _, hash := range h.ring {
		if h.hashMap[hash] != node {
			newRing = append(newRing, hash)
		} else {
			delete(h.hashMap, hash)
		}
	}
	h.ring = newRing
}

// GetNode returns the node responsible for the given key.
func (h *HashRing) GetNode(key string) string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if len(h.ring) == 0 {
		return ""
	}

	hash := h.hash(key)
	// Binary search for the first node with hash >= key hash
	idx := sort.Search(len(h.ring), func(i int) bool { return h.ring[i] >= hash })
	if idx >= len(h.ring) {
		idx = 0 // wrap around
	}
	return h.hashMap[h.ring[idx]]
}

// GetNodes returns the N closest distinct nodes for a key (for replication).
func (h *HashRing) GetNodes(key string, count int) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if len(h.ring) == 0 {
		return nil
	}

	nodeCount := len(h.nodes)
	if count > nodeCount {
		count = nodeCount
	}

	hash := h.hash(key)
	idx := sort.Search(len(h.ring), func(i int) bool { return h.ring[i] >= hash })

	seen := make(map[string]bool)
	result := make([]string, 0, count)

	for i := 0; i < len(h.ring) && len(result) < count; i++ {
		pos := (idx + i) % len(h.ring)
		node := h.hashMap[h.ring[pos]]
		if !seen[node] {
			seen[node] = true
			result = append(result, node)
		}
	}
	return result
}

// GetAllNodes returns all registered physical nodes.
func (h *HashRing) GetAllNodes() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	nodes := make([]string, 0, len(h.nodes))
	for node := range h.nodes {
		nodes = append(nodes, node)
	}
	sort.Strings(nodes)
	return nodes
}

// NodeCount returns the number of physical nodes in the ring.
func (h *HashRing) NodeCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.nodes)
}

// GetDistribution returns how many virtual nodes each physical node owns.
func (h *HashRing) GetDistribution() map[string]int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	dist := make(map[string]int)
	for _, node := range h.hashMap {
		dist[node]++
	}
	return dist
}

func (h *HashRing) hash(key string) uint32 {
	sum := sha256.Sum256([]byte(key))
	return binary.BigEndian.Uint32(sum[:4])
}
