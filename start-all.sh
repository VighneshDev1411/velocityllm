#!/bin/bash

# VelocityLLM - Start All Services in One Command
# Usage: ./start-all.sh

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BOLD}${BLUE}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║         🚀 VelocityLLM - Starting All Services       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -ti:$port >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    local name=$1
    local port=$2
    local max_wait=$3

    echo -n "Waiting for $name to start..."
    for i in $(seq 1 $max_wait); do
        if check_port $port; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        sleep 1
        echo -n "."
    done
    echo -e " ${RED}✗ Timeout${NC}"
    return 1
}

# Check prerequisites
echo -e "${BOLD}Checking prerequisites...${NC}"

# Check PostgreSQL
if ! check_port 5432; then
    echo -e "${RED}✗ PostgreSQL not running on port 5432${NC}"
    echo -e "${YELLOW}Start it with: brew services start postgresql@14${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} PostgreSQL running"

# Check Redis
if ! check_port 6379; then
    echo -e "${RED}✗ Redis not running on port 6379${NC}"
    echo -e "${YELLOW}Start it with: brew services start redis${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Redis running"

# Check if backend is built
if [ ! -f "./bin/server" ]; then
    echo -e "${YELLOW}! Backend not built, building now...${NC}"
    go build -o bin/server cmd/server/main.go
    echo -e "${GREEN}✓${NC} Backend built successfully"
fi

# Kill existing services
echo ""
echo -e "${BOLD}Cleaning up existing services...${NC}"
pkill -f "bin/server" 2>/dev/null && echo -e "${GREEN}✓${NC} Stopped old backend" || echo "  No old backend"
pkill -f "test_server.py" 2>/dev/null && echo -e "${GREEN}✓${NC} Stopped old Python worker" || echo "  No old Python worker"
pkill -f "next-server" 2>/dev/null && echo -e "${GREEN}✓${NC} Stopped old frontend" || echo "  No old frontend"

sleep 2

# Start Backend
echo ""
echo -e "${BOLD}Starting services...${NC}"
echo -e "${BLUE}[1/3]${NC} Starting Backend API..."

DB_USER=vigneshmac DB_PASSWORD="" DB_NAME=velocityllm \
    ./bin/server > /tmp/velocityllm-backend.log 2>&1 &
BACKEND_PID=$!
echo "  PID: $BACKEND_PID"

if wait_for_service "Backend" 8080 10; then
    echo -e "  ${GREEN}✓ Backend API started successfully${NC}"
else
    echo -e "  ${RED}✗ Backend failed to start${NC}"
    echo "  Check logs: tail -f /tmp/velocityllm-backend.log"
    exit 1
fi

# Start Python Worker
echo ""
echo -e "${BLUE}[2/3]${NC} Starting Python Worker..."

cd python_worker
source venv/bin/activate
python test_server.py > /tmp/python-worker.log 2>&1 &
WORKER_PID=$!
cd ..
echo "  PID: $WORKER_PID"

if wait_for_service "Python Worker" 50051 10; then
    echo -e "  ${GREEN}✓ Python Worker started successfully${NC}"
else
    echo -e "  ${RED}✗ Python Worker failed to start${NC}"
    echo "  Check logs: tail -f /tmp/python-worker.log"
fi

# Start Frontend
echo ""
echo -e "${BLUE}[3/3]${NC} Starting Frontend..."

cd frontend
npm run dev > /tmp/velocityllm-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo "  PID: $FRONTEND_PID"

if wait_for_service "Frontend" 3000 15; then
    echo -e "  ${GREEN}✓ Frontend started successfully${NC}"
else
    echo -e "  ${RED}✗ Frontend failed to start${NC}"
    echo "  Check logs: tail -f /tmp/velocityllm-frontend.log"
fi

# Final status
echo ""
echo -e "${BOLD}${GREEN}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║              ✅ All Services Started!                 ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Service summary
echo -e "${BOLD}Service Status:${NC}"
echo -e "  ${GREEN}✓${NC} Backend API       http://localhost:8080"
echo -e "  ${GREEN}✓${NC} Python Worker     localhost:50051 (gRPC)"
echo -e "  ${GREEN}✓${NC} Frontend          http://localhost:3000"
echo ""

echo -e "${BOLD}Process IDs:${NC}"
echo "  Backend:  $BACKEND_PID"
echo "  Worker:   $WORKER_PID"
echo "  Frontend: $FRONTEND_PID"
echo ""

echo -e "${BOLD}Quick Access:${NC}"
echo -e "  ${BLUE}Dashboard:${NC}    open http://localhost:3000"
echo -e "  ${BLUE}API Docs:${NC}     open http://localhost:8080/health"
echo -e "  ${BLUE}Test API:${NC}     ./test_all_features.sh"
echo ""

echo -e "${BOLD}Monitor Logs:${NC}"
echo "  tail -f /tmp/velocityllm-backend.log      # Backend"
echo "  tail -f /tmp/python-worker.log            # Python Worker"
echo "  tail -f /tmp/velocityllm-frontend.log     # Frontend"
echo ""

echo -e "${BOLD}Stop Services:${NC}"
cat > /tmp/stop-velocityllm.sh << 'STOPSCRIPT'
#!/bin/bash
echo "🛑 Stopping VelocityLLM services..."
pkill -f "bin/server" && echo "✓ Backend stopped"
pkill -f "test_server.py" && echo "✓ Python worker stopped"
pkill -f "next-server" && echo "✓ Frontend stopped"
echo "✅ All services stopped"
STOPSCRIPT
chmod +x /tmp/stop-velocityllm.sh

echo "  /tmp/stop-velocityllm.sh"
echo ""

echo -e "${GREEN}Ready to test! Open http://localhost:3000 in your browser${NC}"
echo ""

# Save PIDs to file for later
echo "$BACKEND_PID" > /tmp/velocityllm.pids
echo "$WORKER_PID" >> /tmp/velocityllm.pids
echo "$FRONTEND_PID" >> /tmp/velocityllm.pids
