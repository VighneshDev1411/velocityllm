package optimization

import (
	"database/sql"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// DBConnection wraps a database connection
type DBConnection struct {
	conn      *sql.DB
	createdAt time.Time
	lastUsed  time.Time
	mu        sync.RWMutex
}

// NewDBConnection creates a new database connection wrapper
func NewDBConnection(conn *sql.DB) *DBConnection {
	now := time.Now()
	return &DBConnection{
		conn:      conn,
		createdAt: now,
		lastUsed:  now,
	}
}

// IsHealthy checks if the connection is healthy
func (c *DBConnection) IsHealthy() bool {
	if c.conn == nil {
		return false
	}

	// Ping to check health
	err := c.conn.Ping()
	return err == nil
}

// Close closes the connection
func (c *DBConnection) Close() error {
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

// GetCreatedAt returns when connection was created
func (c *DBConnection) GetCreatedAt() time.Time {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.createdAt
}

// GetLastUsed returns when connection was last used
func (c *DBConnection) GetLastUsed() time.Time {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.lastUsed
}

// MarkUsed updates last used time
func (c *DBConnection) MarkUsed() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.lastUsed = time.Now()
}

// GetDB returns the underlying database connection
func (c *DBConnection) GetDB() *sql.DB {
	return c.conn
}

// DBConnectionFactory creates database connections
type DBConnectionFactory struct {
	dsn string
}

// NewDBConnectionFactory creates a new database connection factory
func NewDBConnectionFactory(dsn string) *DBConnectionFactory {
	return &DBConnectionFactory{dsn: dsn}
}

// Create creates a new database connection
func (f *DBConnectionFactory) Create() (Connection, error) {
	db, err := sql.Open("postgres", f.dsn)
	if err != nil {
		return nil, err
	}

	// Test connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}

	// Configure connection
	db.SetMaxOpenConns(1) // This pool manages one connection
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)

	return NewDBConnection(db), nil
}

// DBPool is a specialized connection pool for databases
type DBPool struct {
	*ConnectionPool
	factory *DBConnectionFactory
}

// NewDBPool creates a new database connection pool
func NewDBPool(config PoolConfig, dsn string) (*DBPool, error) {
	factory := NewDBConnectionFactory(dsn)

	pool, err := NewConnectionPool(config, factory)
	if err != nil {
		return nil, err
	}

	dbPool := &DBPool{
		ConnectionPool: pool,
		factory:        factory,
	}

	utils.Info("Database connection pool initialized")
	return dbPool, nil
}

// AcquireDB acquires a database connection
func (p *DBPool) AcquireDB() (*sql.DB, func(), error) {
	conn, err := p.Acquire()
	if err != nil {
		return nil, nil, err
	}

	dbConn, ok := conn.(*DBConnection)
	if !ok {
		p.Release(conn)
		return nil, nil, ErrInvalidConn
	}

	// Return database and release function
	release := func() {
		p.Release(conn)
	}

	return dbConn.GetDB(), release, nil
}

// Global database pool
var globalDBPool *DBPool
var dbPoolOnce sync.Once

// InitGlobalDBPool initializes the global database pool
func InitGlobalDBPool(config PoolConfig, dsn string) error {
	var err error
	dbPoolOnce.Do(func() {
		globalDBPool, err = NewDBPool(config, dsn)
	})
	return err
}

// GetGlobalDBPool returns the global database pool
func GetGlobalDBPool() *DBPool {
	return globalDBPool
}
