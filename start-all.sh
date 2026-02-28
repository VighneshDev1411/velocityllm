#!/bin/bash

# VelocityLLM — Start All Services
# Usage: ./start-all.sh
# Stop:  Ctrl+C (cleans up all child processes)

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
DIM='\033[2m'
NC='\033[0m'

PIDS=()

# ── Cleanup on Ctrl+C or exit ────────────────────────────────────────────────
cleanup() {
    echo ""
    echo -e "${DIM}Shutting down...${NC}"
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null
    done
    wait 2>/dev/null
    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}
trap cleanup EXIT INT TERM

check_port() { lsof -ti:"$1" >/dev/null 2>&1; }

wait_for_port() {
    local name=$1 port=$2 max=$3
    for i in $(seq 1 "$max"); do
        check_port "$port" && return 0
        sleep 1
    done
    return 1
}

# ── Load .env ────────────────────────────────────────────────────────────────
if [ -f ".env" ]; then
    set -a; source .env; set +a
    echo -e "${GREEN}ok${NC}  .env loaded"
fi

# ── Prerequisites: PostgreSQL & Redis ────────────────────────────────────────
echo ""
echo "Checking services..."

if check_port 5432; then
    echo -e "${GREEN}ok${NC}  PostgreSQL running"
else
    echo -e "${YELLOW}--${NC}  PostgreSQL not on :5432, trying brew..."
    brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
    sleep 2
    if check_port 5432; then
        echo -e "${GREEN}ok${NC}  PostgreSQL started"
    else
        echo -e "${RED}!!${NC}  PostgreSQL failed — start manually: brew services start postgresql@14"
        exit 1
    fi
fi

if check_port 6379; then
    echo -e "${GREEN}ok${NC}  Redis running"
else
    echo -e "${YELLOW}--${NC}  Redis not on :6379, trying brew..."
    brew services start redis 2>/dev/null || true
    sleep 1
    if check_port 6379; then
        echo -e "${GREEN}ok${NC}  Redis started"
    else
        echo -e "${RED}!!${NC}  Redis failed — start manually: brew services start redis"
        exit 1
    fi
fi

# ── Kill old instances ───────────────────────────────────────────────────────
pkill -f "bin/server" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 1

# ── Build Go backend ────────────────────────────────────────────────────────
echo ""
echo "Building backend..."
go build -o bin/server cmd/server/main.go
echo -e "${GREEN}ok${NC}  Backend built"

# ── Start Backend ────────────────────────────────────────────────────────────
echo ""
echo "Starting services..."

./bin/server > /tmp/velocityllm-backend.log 2>&1 &
PIDS+=($!)
if wait_for_port "Backend" 8080 10; then
    echo -e "${GREEN}ok${NC}  Backend        http://localhost:${SERVER_PORT:-8080}  (PID ${PIDS[-1]})"
else
    echo -e "${RED}!!${NC}  Backend failed — check /tmp/velocityllm-backend.log"
    exit 1
fi

# ── Start Python Worker (optional) ──────────────────────────────────────────
if [ -d "$ROOT_DIR/python_worker" ] && [ -f "$ROOT_DIR/python_worker/venv/bin/activate" ]; then
    (
        cd "$ROOT_DIR/python_worker"
        source venv/bin/activate
        python test_server.py > /tmp/python-worker.log 2>&1
    ) &
    PIDS+=($!)
    if wait_for_port "Worker" 50051 8; then
        echo -e "${GREEN}ok${NC}  Python Worker  localhost:50051          (PID ${PIDS[-1]})"
    else
        echo -e "${YELLOW}--${NC}  Python Worker  skipped (failed to start)"
    fi
else
    echo -e "${DIM}--  Python Worker  skipped (no venv found)${NC}"
fi

# ── Start Frontend ───────────────────────────────────────────────────────────
cd "$ROOT_DIR/frontend"
npx next dev --port 3000 > /tmp/velocityllm-frontend.log 2>&1 &
PIDS+=($!)
cd "$ROOT_DIR"
if wait_for_port "Frontend" 3000 15; then
    echo -e "${GREEN}ok${NC}  Frontend       http://localhost:3000     (PID ${PIDS[-1]})"
else
    echo -e "${RED}!!${NC}  Frontend failed — check /tmp/velocityllm-frontend.log"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}VelocityLLM is running.${NC}"
echo -e "${DIM}Press Ctrl+C to stop all services.${NC}"
echo ""
echo "  Logs:"
echo "    tail -f /tmp/velocityllm-backend.log"
echo "    tail -f /tmp/velocityllm-frontend.log"
echo ""

# Keep script alive — wait for child processes
wait
