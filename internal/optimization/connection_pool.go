package optimization

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

var (
	ErrPoolClosed     = errors.New("connection pool is closed")
	ErrAcquireTimeout = errors.New("timeout acquiring connection")
	ErrPoolExhausted  = errors.New("connection pool exhausted")
	ErrInvalidConn    = errors.New("invalid connection")
)

// ConnectionPool manages a pool of reusable connections
type ConnectionPool struct {
	config       PoolConfig
	factory      ConnectionFactory
	connections  chan Connection
	allConns     []Connection
	stats        PoolStats
	closed       bool
	mu           sync.RWMutex
	waitQueue    chan struct{}
	healthTicker *time.Ticker
}

// NewConnectionPool creates a new connection pool
func NewConnectionPool(config PoolConfig, factory ConnectionFactory) (*ConnectionPool, error) {
	if config.MaxConnections < config.MinConnections {
		return nil, errors.New("max connections must be >= min connections")
	}

	pool := &ConnectionPool{
		config:      config,
		factory:     factory,
		connections: make(chan Connection, config.MaxConnections),
		allConns:    make([]Connection, 0, config.MaxConnections),
		waitQueue:   make(chan struct{}, config.MaxConnections),
	}

	// Create minimum connections
	for i := 0; i < config.MinConnections; i++ {
		conn, err := factory.Create()
		if err != nil {
			pool.Close()
			return nil, err
		}
		pool.connections <- conn
		pool.allConns = append(pool.allConns, conn)
		pool.stats.TotalConnections++
		pool.stats.IdleConnections++
		pool.stats.ConnectionsCreated++
	}

	// Start health check routine
	pool.startHealthCheck()

	utils.Info("Connection pool initialized: %d/%d connections",
		config.MinConnections, config.MaxConnections)

	return pool, nil
}

// Acquire gets a connection from the pool
func (p *ConnectionPool) Acquire() (Connection, error) {
	return p.AcquireWithContext(context.Background())
}

// AcquireWithContext gets a connection with context
func (p *ConnectionPool) AcquireWithContext(ctx context.Context) (Connection, error) {
	p.mu.RLock()
	if p.closed {
		p.mu.RUnlock()
		return nil, ErrPoolClosed
	}
	p.mu.RUnlock()

	startWait := time.Now()

	// Try to get existing connection
	select {
	case conn := <-p.connections:
		p.updateStatsOnAcquire(time.Since(startWait))

		// Check if connection is healthy
		if !conn.IsHealthy() {
			conn.Close()
			p.removeConnection(conn)
			// Try again
			return p.AcquireWithContext(ctx)
		}

		conn.MarkUsed()
		return conn, nil

	default:
		// No idle connection, try to create new one
		if p.canCreateConnection() {
			conn, err := p.createConnection()
			if err != nil {
				p.mu.Lock()
				p.stats.Errors++
				p.mu.Unlock()
				return nil, err
			}
			p.updateStatsOnAcquire(time.Since(startWait))
			return conn, nil
		}

		// Pool is at max, wait for available connection
		timeout := p.config.AcquireTimeout
		if timeout == 0 {
			timeout = 5 * time.Second
		}

		timeoutCtx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()

		select {
		case conn := <-p.connections:
			p.updateStatsOnAcquire(time.Since(startWait))

			if !conn.IsHealthy() {
				conn.Close()
				p.removeConnection(conn)
				return p.AcquireWithContext(ctx)
			}

			conn.MarkUsed()
			return conn, nil

		case <-timeoutCtx.Done():
			p.mu.Lock()
			p.stats.Errors++
			p.mu.Unlock()
			return nil, ErrAcquireTimeout
		}
	}
}

// Release returns a connection to the pool
func (p *ConnectionPool) Release(conn Connection) error {
	if conn == nil {
		return ErrInvalidConn
	}

	p.mu.RLock()
	if p.closed {
		p.mu.RUnlock()
		return conn.Close()
	}
	p.mu.RUnlock()

	// Check if connection is still healthy
	if !conn.IsHealthy() {
		conn.Close()
		p.removeConnection(conn)
		return nil
	}

	// Check connection age
	if time.Since(conn.GetCreatedAt()) > p.config.MaxLifetime {
		conn.Close()
		p.removeConnection(conn)
		return nil
	}

	// Return to pool
	select {
	case p.connections <- conn:
		p.mu.Lock()
		p.stats.ActiveConnections--
		p.stats.IdleConnections++
		p.mu.Unlock()
		return nil
	default:
		// Pool is full, close connection
		conn.Close()
		p.removeConnection(conn)
		return nil
	}
}

// canCreateConnection checks if we can create a new connection
func (p *ConnectionPool) canCreateConnection() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.stats.TotalConnections < p.config.MaxConnections
}

// createConnection creates a new connection
func (p *ConnectionPool) createConnection() (Connection, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.stats.TotalConnections >= p.config.MaxConnections {
		return nil, ErrPoolExhausted
	}

	conn, err := p.factory.Create()
	if err != nil {
		return nil, err
	}

	p.allConns = append(p.allConns, conn)
	p.stats.TotalConnections++
	p.stats.ActiveConnections++
	p.stats.ConnectionsCreated++

	return conn, nil
}

// removeConnection removes a connection from tracking
func (p *ConnectionPool) removeConnection(conn Connection) {
	p.mu.Lock()
	defer p.mu.Unlock()

	for i, c := range p.allConns {
		if c == conn {
			p.allConns = append(p.allConns[:i], p.allConns[i+1:]...)
			break
		}
	}

	p.stats.TotalConnections--
	p.stats.ConnectionsClosed++
}

// updateStatsOnAcquire updates statistics when connection is acquired
func (p *ConnectionPool) updateStatsOnAcquire(waitDuration time.Duration) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.stats.WaitCount++
	p.stats.WaitDuration += waitDuration
	p.stats.IdleConnections--
	p.stats.ActiveConnections++
}

// startHealthCheck starts periodic health checking
func (p *ConnectionPool) startHealthCheck() {
	if p.config.HealthCheckPeriod == 0 {
		return
	}

	p.healthTicker = time.NewTicker(p.config.HealthCheckPeriod)

	go func() {
		for range p.healthTicker.C {
			p.healthCheck()
		}
	}()
}

// healthCheck checks and removes unhealthy connections
func (p *ConnectionPool) healthCheck() {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return
	}

	now := time.Now()
	toRemove := make([]Connection, 0)

	for _, conn := range p.allConns {
		// Check if connection is too old
		if now.Sub(conn.GetCreatedAt()) > p.config.MaxLifetime {
			toRemove = append(toRemove, conn)
			continue
		}

		// Check if connection has been idle too long
		if now.Sub(conn.GetLastUsed()) > p.config.MaxIdleTime {
			toRemove = append(toRemove, conn)
			continue
		}

		// Check if connection is healthy
		if !conn.IsHealthy() {
			toRemove = append(toRemove, conn)
			continue
		}
	}

	// Remove unhealthy connections
	for _, conn := range toRemove {
		conn.Close()
		for i, c := range p.allConns {
			if c == conn {
				p.allConns = append(p.allConns[:i], p.allConns[i+1:]...)
				break
			}
		}
		p.stats.TotalConnections--
		p.stats.ConnectionsClosed++
	}

	if len(toRemove) > 0 {
		utils.Debug("Health check removed %d unhealthy connections", len(toRemove))
	}
}

// GetStats returns pool statistics
func (p *ConnectionPool) GetStats() PoolStats {
	p.mu.RLock()
	defer p.mu.RUnlock()

	stats := p.stats
	stats.IdleConnections = len(p.connections)
	return stats
}

// Close closes the pool and all connections
func (p *ConnectionPool) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return nil
	}

	p.closed = true

	// Stop health check
	if p.healthTicker != nil {
		p.healthTicker.Stop()
	}

	// Close all connections
	close(p.connections)
	for _, conn := range p.allConns {
		conn.Close()
	}

	p.allConns = nil
	utils.Info("Connection pool closed")

	return nil
}

// Resize dynamically adjusts pool size
func (p *ConnectionPool) Resize(newMax int) error {
	if newMax < p.config.MinConnections {
		return errors.New("new max must be >= min connections")
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	oldMax := p.config.MaxConnections
	p.config.MaxConnections = newMax

	// If shrinking, close excess connections
	if newMax < oldMax {
		excess := p.stats.TotalConnections - newMax
		if excess > 0 {
			toClose := 0
			for i := len(p.allConns) - 1; i >= 0 && toClose < excess; i-- {
				conn := p.allConns[i]
				// Only close idle connections
				select {
				case c := <-p.connections:
					if c == conn {
						c.Close()
						p.allConns = append(p.allConns[:i], p.allConns[i+1:]...)
						p.stats.TotalConnections--
						p.stats.ConnectionsClosed++
						toClose++
					} else {
						p.connections <- c
					}
				default:
					break
				}
			}
		}
	}

	utils.Info("Connection pool resized: %d → %d max connections", oldMax, newMax)
	return nil
}
