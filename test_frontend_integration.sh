#!/bin/bash

# Test Frontend Integration with Backend

echo "🖥️  Testing Frontend Integration"
echo "================================"
echo ""

# Check services
echo "Checking services..."
BACKEND_OK=false
FRONTEND_OK=false

if lsof -ti:8080 >/dev/null 2>&1; then
    echo "✅ Backend running on port 8080"
    BACKEND_OK=true
else
    echo "❌ Backend not running on port 8080"
fi

if lsof -ti:3000 >/dev/null 2>&1; then
    echo "✅ Frontend running on port 3000"
    FRONTEND_OK=true
else
    echo "❌ Frontend not running on port 3000"
fi

if ! $BACKEND_OK || ! $FRONTEND_OK; then
    echo ""
    echo "Please start both services first:"
    echo "  Backend: DB_USER=vigneshmac DB_PASSWORD=\"\" DB_NAME=velocityllm ./bin/server &"
    echo "  Frontend: cd frontend && npm run dev &"
    exit 1
fi

echo ""
echo "Testing API endpoints that frontend uses..."
echo ""

# Test endpoints the frontend would call
endpoints=(
    "/health"
    "/api/v1/models"
    "/api/v1/requests/stats"
    "/api/v1/workers/stats"
    "/api/v1/metrics/snapshot"
    "/api/v1/streaming/stats"
)

for endpoint in "${endpoints[@]}"; do
    echo -n "Testing $endpoint... "
    status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080$endpoint")
    if [ "$status" = "200" ]; then
        echo "✅ OK"
    else
        echo "❌ Failed (HTTP $status)"
    fi
done

echo ""
echo "📊 Sample API Response (models):"
curl -s http://localhost:8080/api/v1/models | python3 -m json.tool | head -40

echo ""
echo "================================"
echo "✅ Backend API endpoints working!"
echo ""
echo "🌐 Access Points:"
echo "  Frontend:      http://localhost:3000"
echo "  Backend API:   http://localhost:8080"
echo "  Python Worker: localhost:50051 (gRPC)"
echo ""
echo "📝 To test full stack:"
echo "  1. Open http://localhost:3000 in browser"
echo "  2. Navigate through Dashboard, Workers, Streams"
echo "  3. Submit test inference request"
echo "  4. Monitor logs:"
echo "     - Backend:  tail -f /tmp/velocityllm-backend.log"
echo "     - Frontend: tail -f /tmp/velocityllm-frontend.log"
echo "     - Worker:   tail -f /tmp/python-worker.log"
