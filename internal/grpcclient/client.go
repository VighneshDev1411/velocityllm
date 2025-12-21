package grpcclient

import (
	"context"
	"fmt"
	"io"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"

	pb "github.com/VighneshDev1411/velocityllm/internal/grpc/pb"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// InferenceClient wraps the gRPC client for LLM inference
type InferenceClient struct {
	address string
	conn    *grpc.ClientConn
	client  pb.InferenceServiceClient
	logger  *utils.Logger

	// Connection state
	isConnected bool
	mu          sync.RWMutex

	// Metrics
	totalRequests  int64
	failedRequests int64
	metricsMu      sync.RWMutex
}

// ClientConfig holds configuration for the gRPC client
type ClientConfig struct {
	Address           string
	MaxRetries        int
	RequestTimeout    time.Duration
	ConnectionTimeout time.Duration
	KeepAliveTime     time.Duration
	KeepAliveTimeout  time.Duration
	MaxRecvMsgSize    int
	MaxSendMsgSize    int
}

// DefaultClientConfig returns default client configuration
func DefaultClientConfig() *ClientConfig {
	return &ClientConfig{
		Address:           "localhost:50051",
		MaxRetries:        3,
		RequestTimeout:    5 * time.Minute,
		ConnectionTimeout: 10 * time.Second,
		KeepAliveTime:     30 * time.Second,
		KeepAliveTimeout:  10 * time.Second,
		MaxRecvMsgSize:    100 * 1024 * 1024, // 100 MB
		MaxSendMsgSize:    100 * 1024 * 1024, // 100 MB
	}
}

// NewInferenceClient creates a new gRPC inference client
func NewInferenceClient(config *ClientConfig, logger *utils.Logger) (*InferenceClient, error) {
	if config == nil {
		config = DefaultClientConfig()
	}

	client := &InferenceClient{
		address:     config.Address,
		logger:      logger,
		isConnected: false,
	}

	// Establish connection
	if err := client.Connect(config); err != nil {
		return nil, fmt.Errorf("failed to connect: %w", err)
	}

	return client, nil
}

// Connect establishes connection to the gRPC server
func (c *InferenceClient) Connect(config *ClientConfig) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Set up connection options
	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                config.KeepAliveTime,
			Timeout:             config.KeepAliveTimeout,
			PermitWithoutStream: true,
		}),
		grpc.WithDefaultCallOptions(
			grpc.MaxCallRecvMsgSize(config.MaxRecvMsgSize),
			grpc.MaxCallSendMsgSize(config.MaxSendMsgSize),
		),
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), config.ConnectionTimeout)
	defer cancel()

	c.logger.Info("Connecting to gRPC server", "address", config.Address)

	// Establish connection
	conn, err := grpc.DialContext(ctx, config.Address, opts...)
	if err != nil {
		return fmt.Errorf("failed to dial: %w", err)
	}

	c.conn = conn
	c.client = pb.NewInferenceServiceClient(conn)
	c.isConnected = true

	c.logger.Info("Successfully connected to gRPC server", "address", config.Address)

	return nil
}

// Inference performs synchronous inference
func (c *InferenceClient) Inference(ctx context.Context, req *pb.InferenceRequest) (*pb.InferenceResponse, error) {
	if !c.IsConnected() {
		return nil, fmt.Errorf("client is not connected")
	}

	c.incrementRequests()

	c.logger.Debug("Sending inference request",
		"request_id", req.RequestId,
		"model", req.ModelName,
		"prompt_length", len(req.Prompt),
	)

	// Call gRPC method
	resp, err := c.client.Inference(ctx, req)
	if err != nil {
		c.incrementFailedRequests()
		c.logger.Error("Inference request failed",
			"request_id", req.RequestId,
			"error", err,
		)
		return nil, fmt.Errorf("inference failed: %w", err)
	}

	c.logger.Debug("Inference completed",
		"request_id", resp.RequestId,
		"tokens_generated", resp.TokensGenerated,
		"inference_time_ms", resp.InferenceTimeMs,
	)

	return resp, nil
}

// StreamInference performs streaming inference
func (c *InferenceClient) StreamInference(ctx context.Context, req *pb.InferenceRequest, chunkHandler func(*pb.InferenceStreamResponse) error) error {
	if !c.IsConnected() {
		return fmt.Errorf("client is not connected")
	}

	c.incrementRequests()

	c.logger.Debug("Starting streaming inference",
		"request_id", req.RequestId,
		"model", req.ModelName,
	)

	// Call streaming gRPC method
	stream, err := c.client.StreamInference(ctx, req)
	if err != nil {
		c.incrementFailedRequests()
		c.logger.Error("Stream inference failed",
			"request_id", req.RequestId,
			"error", err,
		)
		return fmt.Errorf("stream inference failed: %w", err)
	}

	// Receive stream chunks
	chunkCount := 0
	for {
		chunk, err := stream.Recv()
		if err == io.EOF {
			// Stream completed
			break
		}
		if err != nil {
			c.incrementFailedRequests()
			c.logger.Error("Stream receive error",
				"request_id", req.RequestId,
				"error", err,
			)
			return fmt.Errorf("stream receive failed: %w", err)
		}

		chunkCount++

		// Handle chunk
		if err := chunkHandler(chunk); err != nil {
			c.logger.Error("Chunk handler error",
				"request_id", req.RequestId,
				"chunk_index", chunk.ChunkIndex,
				"error", err,
			)
			return fmt.Errorf("chunk handler failed: %w", err)
		}

		// Check if final chunk
		if chunk.IsFinal {
			c.logger.Debug("Stream completed",
				"request_id", req.RequestId,
				"chunks_received", chunkCount,
				"total_tokens", chunk.TotalTokens,
			)
			break
		}
	}

	return nil
}

// LoadModel loads a model into the worker
func (c *InferenceClient) LoadModel(ctx context.Context, req *pb.LoadModelRequest) (*pb.LoadModelResponse, error) {
	if !c.IsConnected() {
		return nil, fmt.Errorf("client is not connected")
	}

	c.logger.Info("Loading model",
		"model_name", req.ModelName,
		"model_path", req.ModelPath,
		"device", req.Device,
	)

	resp, err := c.client.LoadModel(ctx, req)
	if err != nil {
		c.logger.Error("Load model failed",
			"model_name", req.ModelName,
			"error", err,
		)
		return nil, fmt.Errorf("load model failed: %w", err)
	}

	if resp.Success {
		c.logger.Info("Model loaded successfully",
			"model_name", resp.ModelName,
			"load_time_ms", resp.LoadTimeMs,
			"model_size_mb", resp.ModelSizeMb,
		)
	} else {
		c.logger.Error("Model load failed",
			"model_name", resp.ModelName,
			"error", resp.Error,
		)
	}

	return resp, nil
}

// UnloadModel unloads a model from the worker
func (c *InferenceClient) UnloadModel(ctx context.Context, req *pb.UnloadModelRequest) (*pb.UnloadModelResponse, error) {
	if !c.IsConnected() {
		return nil, fmt.Errorf("client is not connected")
	}

	c.logger.Info("Unloading model", "model_name", req.ModelName)

	resp, err := c.client.UnloadModel(ctx, req)
	if err != nil {
		c.logger.Error("Unload model failed",
			"model_name", req.ModelName,
			"error", err,
		)
		return nil, fmt.Errorf("unload model failed: %w", err)
	}

	if resp.Success {
		c.logger.Info("Model unloaded successfully",
			"model_name", resp.ModelName,
			"unload_time_ms", resp.UnloadTimeMs,
		)
	}

	return resp, nil
}

// GetModelInfo retrieves information about a model
func (c *InferenceClient) GetModelInfo(ctx context.Context, modelName string) (*pb.GetModelInfoResponse, error) {
	if !c.IsConnected() {
		return nil, fmt.Errorf("client is not connected")
	}

	req := &pb.GetModelInfoRequest{
		ModelName: modelName,
	}

	resp, err := c.client.GetModelInfo(ctx, req)
	if err != nil {
		c.logger.Error("Get model info failed",
			"model_name", modelName,
			"error", err,
		)
		return nil, fmt.Errorf("get model info failed: %w", err)
	}

	return resp, nil
}

// HealthCheck performs a health check on the worker
func (c *InferenceClient) HealthCheck(ctx context.Context, detailed bool) (*pb.HealthCheckResponse, error) {
	if !c.IsConnected() {
		return nil, fmt.Errorf("client is not connected")
	}

	req := &pb.HealthCheckRequest{
		Detailed: detailed,
	}

	resp, err := c.client.HealthCheck(ctx, req)
	if err != nil {
		c.logger.Error("Health check failed", "error", err)
		return nil, fmt.Errorf("health check failed: %w", err)
	}

	c.logger.Debug("Health check completed",
		"status", resp.Status,
		"active_requests", resp.ActiveRequests,
		"loaded_models", resp.LoadedModels,
	)

	return resp, nil
}

// IsConnected returns whether the client is connected
func (c *InferenceClient) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.isConnected
}

// Close closes the gRPC connection
func (c *InferenceClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn != nil {
		c.logger.Info("Closing gRPC connection", "address", c.address)
		err := c.conn.Close()
		c.isConnected = false
		return err
	}

	return nil
}

// GetMetrics returns client metrics
func (c *InferenceClient) GetMetrics() map[string]interface{} {
	c.metricsMu.RLock()
	defer c.metricsMu.RUnlock()

	successRate := float64(0)
	if c.totalRequests > 0 {
		successRate = float64(c.totalRequests-c.failedRequests) / float64(c.totalRequests) * 100
	}

	return map[string]interface{}{
		"address":         c.address,
		"connected":       c.IsConnected(),
		"total_requests":  c.totalRequests,
		"failed_requests": c.failedRequests,
		"success_rate":    fmt.Sprintf("%.2f%%", successRate),
	}
}

// incrementRequests increments total request counter
func (c *InferenceClient) incrementRequests() {
	c.metricsMu.Lock()
	defer c.metricsMu.Unlock()
	c.totalRequests++
}

// incrementFailedRequests increments failed request counter
func (c *InferenceClient) incrementFailedRequests() {
	c.metricsMu.Lock()
	defer c.metricsMu.Unlock()
	c.failedRequests++
}

// Retry wrapper for resilient calls
func (c *InferenceClient) withRetry(ctx context.Context, maxRetries int, operation func() error) error {
	var lastErr error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff
			backoff := time.Duration(1<<uint(attempt-1)) * time.Second
			c.logger.Info("Retrying operation",
				"attempt", attempt,
				"backoff_seconds", backoff.Seconds(),
			)

			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		err := operation()
		if err == nil {
			return nil
		}

		lastErr = err
		c.logger.Warn("Operation failed",
			"attempt", attempt,
			"error", err,
		)
	}

	return fmt.Errorf("operation failed after %d attempts: %w", maxRetries, lastErr)
}
