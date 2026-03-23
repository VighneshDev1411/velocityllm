package mesh

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// ServiceInstance represents a registered service in the mesh.
type ServiceInstance struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Host      string            `json:"host"`
	Port      int               `json:"port"`
	Version   string            `json:"version"`
	Status    InstanceStatus    `json:"status"`
	Metadata  map[string]string `json:"metadata,omitempty"`
	Health    HealthState       `json:"health"`
	Region    string            `json:"region,omitempty"`
	Zone      string            `json:"zone,omitempty"`
	Weight    int               `json:"weight"`
	StartedAt time.Time         `json:"started_at"`
	LastSeen  time.Time         `json:"last_seen"`
}

type InstanceStatus string

const (
	StatusActive   InstanceStatus = "active"
	StatusDraining InstanceStatus = "draining"
	StatusStopped  InstanceStatus = "stopped"
)

type HealthState string

const (
	HealthHealthy   HealthState = "healthy"
	HealthDegraded  HealthState = "degraded"
	HealthUnhealthy HealthState = "unhealthy"
	HealthUnknown   HealthState = "unknown"
)

// Endpoint returns host:port for the service instance.
func (si *ServiceInstance) Endpoint() string {
	return fmt.Sprintf("%s:%d", si.Host, si.Port)
}

// ServiceRegistry manages service discovery and registration.
type ServiceRegistry struct {
	mu        sync.RWMutex
	rdb       *redis.Client
	services  map[string]*ServiceInstance // local cache of known services
	self      *ServiceInstance
	ttl       time.Duration
	prefix    string
	stopCh    chan struct{}
}

const (
	registryPrefix = "velocityllm:mesh:services:"
	registryTTL    = 30 * time.Second
	heartbeatInterval = 10 * time.Second
)

// NewServiceRegistry creates a new service registry.
func NewServiceRegistry(rdb *redis.Client, self *ServiceInstance) *ServiceRegistry {
	sr := &ServiceRegistry{
		rdb:      rdb,
		services: make(map[string]*ServiceInstance),
		self:     self,
		ttl:      registryTTL,
		prefix:   registryPrefix,
		stopCh:   make(chan struct{}),
	}

	// Register self
	sr.register(self)

	// Start heartbeat
	go sr.heartbeatLoop()

	// Start discovery
	go sr.discoveryLoop()

	log.Printf("[ServiceRegistry] Registered: %s at %s", self.Name, self.Endpoint())
	return sr
}

func (sr *ServiceRegistry) register(instance *ServiceInstance) {
	if sr.rdb == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	instance.LastSeen = time.Now()
	data, _ := json.Marshal(instance)
	key := sr.prefix + instance.ID

	sr.rdb.Set(ctx, key, string(data), sr.ttl)
}

func (sr *ServiceRegistry) heartbeatLoop() {
	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-sr.stopCh:
			return
		case <-ticker.C:
			sr.self.LastSeen = time.Now()
			sr.register(sr.self)
		}
	}
}

func (sr *ServiceRegistry) discoveryLoop() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-sr.stopCh:
			return
		case <-ticker.C:
			sr.discoverServices()
		}
	}
}

func (sr *ServiceRegistry) discoverServices() {
	if sr.rdb == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	keys, err := sr.rdb.Keys(ctx, sr.prefix+"*").Result()
	if err != nil {
		return
	}

	sr.mu.Lock()
	defer sr.mu.Unlock()

	// Clear and rebuild
	discovered := make(map[string]*ServiceInstance)
	for _, key := range keys {
		data, err := sr.rdb.Get(ctx, key).Result()
		if err != nil {
			continue
		}

		var instance ServiceInstance
		if err := json.Unmarshal([]byte(data), &instance); err != nil {
			continue
		}
		discovered[instance.ID] = &instance
	}
	sr.services = discovered
}

// GetInstances returns all active instances of a service.
func (sr *ServiceRegistry) GetInstances(serviceName string) []*ServiceInstance {
	sr.mu.RLock()
	defer sr.mu.RUnlock()

	var instances []*ServiceInstance
	for _, inst := range sr.services {
		if inst.Name == serviceName && inst.Status == StatusActive {
			instances = append(instances, inst)
		}
	}
	return instances
}

// GetAllInstances returns all registered service instances.
func (sr *ServiceRegistry) GetAllInstances() []*ServiceInstance {
	sr.mu.RLock()
	defer sr.mu.RUnlock()

	instances := make([]*ServiceInstance, 0, len(sr.services))
	for _, inst := range sr.services {
		instances = append(instances, inst)
	}
	return instances
}

// GetHealthyInstances returns only healthy instances of a service.
func (sr *ServiceRegistry) GetHealthyInstances(serviceName string) []*ServiceInstance {
	sr.mu.RLock()
	defer sr.mu.RUnlock()

	var instances []*ServiceInstance
	for _, inst := range sr.services {
		if inst.Name == serviceName && inst.Status == StatusActive && inst.Health == HealthHealthy {
			instances = append(instances, inst)
		}
	}
	return instances
}

// UpdateHealth updates the health state of a service instance.
func (sr *ServiceRegistry) UpdateHealth(instanceID string, health HealthState) {
	sr.mu.Lock()
	if inst, ok := sr.services[instanceID]; ok {
		inst.Health = health
	}
	sr.mu.Unlock()

	// Update self if it's us
	if instanceID == sr.self.ID {
		sr.self.Health = health
		sr.register(sr.self)
	}
}

// Drain marks this instance as draining (no new traffic).
func (sr *ServiceRegistry) Drain() {
	sr.self.Status = StatusDraining
	sr.register(sr.self)
	log.Printf("[ServiceRegistry] Instance %s is draining", sr.self.ID)
}

// Deregister removes this instance from the registry.
func (sr *ServiceRegistry) Deregister() {
	if sr.rdb == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	sr.rdb.Del(ctx, sr.prefix+sr.self.ID)
	log.Printf("[ServiceRegistry] Deregistered: %s", sr.self.ID)
}

// Stop shuts down the registry.
func (sr *ServiceRegistry) Stop() {
	close(sr.stopCh)
	sr.Deregister()
}
