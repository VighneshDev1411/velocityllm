package optimization

import (
	"crypto/tls"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// HTTPConnection wraps an HTTP client
type HTTPConnection struct {
	client    *http.Client
	createdAt time.Time
	lastUsed  time.Time
	mu        sync.RWMutex
}

// NewHTTPConnection creates a new HTTP connection wrapper
func NewHTTPConnection(client *http.Client) *HTTPConnection {
	now := time.Now()
	return &HTTPConnection{
		client:    client,
		createdAt: now,
		lastUsed:  now,
	}
}

// IsHealthy checks if the connection is healthy
func (c *HTTPConnection) IsHealthy() bool {
	return c.client != nil
}

// Close closes the connection (HTTP clients don't need explicit closing)
func (c *HTTPConnection) Close() error {
	// HTTP clients manage their own connection pooling
	// We just clean up the transport
	if c.client != nil && c.client.Transport != nil {
		if transport, ok := c.client.Transport.(*http.Transport); ok {
			transport.CloseIdleConnections()
		}
	}
	return nil
}

// GetCreatedAt returns when connection was created
func (c *HTTPConnection) GetCreatedAt() time.Time {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.createdAt
}

// GetLastUsed returns when connection was last used
func (c *HTTPConnection) GetLastUsed() time.Time {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.lastUsed
}

// MarkUsed updates last used time
func (c *HTTPConnection) MarkUsed() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.lastUsed = time.Now()
}

// GetClient returns the underlying HTTP client
func (c *HTTPConnection) GetClient() *http.Client {
	return c.client
}

// HTTPConnectionFactory creates HTTP clients
type HTTPConnectionFactory struct {
	timeout time.Duration
}

// NewHTTPConnectionFactory creates a new HTTP connection factory
func NewHTTPConnectionFactory(timeout time.Duration) *HTTPConnectionFactory {
	return &HTTPConnectionFactory{timeout: timeout}
}

// Create creates a new HTTP client
func (f *HTTPConnectionFactory) Create() (Connection, error) {
	// Create optimized transport
	transport := &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   10,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: false,
		},
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   f.timeout,
	}

	return NewHTTPConnection(client), nil
}

// HTTPPool is a specialized connection pool for HTTP clients
type HTTPPool struct {
	*ConnectionPool
	factory *HTTPConnectionFactory
}

// NewHTTPPool creates a new HTTP connection pool
func NewHTTPPool(config PoolConfig, timeout time.Duration) (*HTTPPool, error) {
	factory := NewHTTPConnectionFactory(timeout)

	pool, err := NewConnectionPool(config, factory)
	if err != nil {
		return nil, err
	}

	httpPool := &HTTPPool{
		ConnectionPool: pool,
		factory:        factory,
	}

	utils.Info("HTTP connection pool initialized")
	return httpPool, nil
}

// AcquireHTTP acquires an HTTP client
func (p *HTTPPool) AcquireHTTP() (*http.Client, func(), error) {
	conn, err := p.Acquire()
	if err != nil {
		return nil, nil, err
	}

	httpConn, ok := conn.(*HTTPConnection)
	if !ok {
		p.Release(conn)
		return nil, nil, ErrInvalidConn
	}

	// Return client and release function
	release := func() {
		p.Release(conn)
	}

	return httpConn.GetClient(), release, nil
}

// Global HTTP pool
var globalHTTPPool *HTTPPool
var httpPoolOnce sync.Once

// InitGlobalHTTPPool initializes the global HTTP pool
func InitGlobalHTTPPool(config PoolConfig, timeout time.Duration) error {
	var err error
	httpPoolOnce.Do(func() {
		globalHTTPPool, err = NewHTTPPool(config, timeout)
	})
	return err
}

// GetGlobalHTTPPool returns the global HTTP pool
func GetGlobalHTTPPool() *HTTPPool {
	return globalHTTPPool
}
