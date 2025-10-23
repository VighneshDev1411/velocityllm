# VelocityLLM Makefile

.PHONY: help build run test clean docker-build docker-up docker-down

# Default target
help:
	@echo "VelocityLLM - Development Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make build        - Build the Go binary"
	@echo "  make run          - Run the API server"
	@echo "  make test         - Run all tests"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make docker-build - Build Docker images"
	@echo "  make docker-up    - Start Docker Compose services"
	@echo "  make docker-down  - Stop Docker Compose services"
	@echo "  make lint         - Run linters"
	@echo ""

# Build the main binary
build:
	@echo "Building VelocityLLM..."
	go build -o bin/server cmd/server/main.go

# Run the server
run:
	@echo "Starting VelocityLLM server..."
	go run cmd/server/main.go

# Run tests
test:
	@echo "Running tests..."
	go test -v ./...

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Clean build artifacts
clean:
	@echo "Cleaning..."
	rm -rf bin/
	rm -f coverage.out coverage.html

# Install dependencies
deps:
	@echo "Installing dependencies..."
	go mod download
	go mod tidy

# Run linters
lint:
	@echo "Running linters..."
	@command -v golangci-lint >/dev/null 2>&1 || { echo "golangci-lint not installed. Run: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"; exit 1; }
	golangci-lint run

# Format code
fmt:
	@echo "Formatting code..."
	go fmt ./...

# Docker commands
docker-build:
	@echo "Building Docker images..."
	docker-compose -f deployments/docker/docker-compose.yml build

docker-up:
	@echo "Starting services..."
	docker-compose -f deployments/docker/docker-compose.yml up -d

docker-down:
	@echo "Stopping services..."
	docker-compose -f deployments/docker/docker-compose.yml down

docker-logs:
	docker-compose -f deployments/docker/docker-compose.yml logs -f

# Development helpers
dev:
	@echo "Starting development mode with hot reload..."
	@command -v air >/dev/null 2>&1 || { echo "air not installed. Run: go install github.com/cosmtrek/air@latest"; exit 1; }
	air

# Install development tools
install-tools:
	@echo "Installing development tools..."
	go install github.com/cosmtrek/air@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest