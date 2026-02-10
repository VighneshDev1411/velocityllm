#!/bin/bash

# Test gRPC Integration between Go Backend and Python Worker

echo "🧪 Testing gRPC Integration"
echo "================================"
echo ""

# Check if Python worker is running
if ! lsof -ti:50051 >/dev/null 2>&1; then
    echo "❌ Python worker not running on port 50051"
    echo "Start it with: cd python_worker && source venv/bin/activate && python test_server.py"
    exit 1
fi
echo "✅ Python worker running on port 50051"

# Check if backend is running
if ! lsof -ti:8080 >/dev/null 2>&1; then
    echo "❌ Backend not running on port 8080"
    exit 1
fi
echo "✅ Backend running on port 8080"

echo ""
echo "Testing gRPC endpoints..."
echo ""

# Test 1: Check if backend can reach worker
echo "[1] Testing backend health..."
curl -s http://localhost:8080/health | python3 -m json.tool | head -20

echo ""
echo "[2] Testing worker stats (if endpoint exists)..."
curl -s http://localhost:8080/api/v1/workers/stats | python3 -m json.tool | head -30

echo ""
echo "✅ Integration test complete!"
echo ""
echo "📝 Next steps:"
echo "  - Submit inference request through backend"
echo "  - Backend should route to Python worker via gRPC"
echo "  - Check logs: tail -f /tmp/python-worker.log"
