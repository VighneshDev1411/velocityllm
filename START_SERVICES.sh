#!/bin/bash

# VelocityLLM - Start All Services
# Quick script to start backend and frontend

echo "🚀 Starting VelocityLLM Services..."
echo ""

# Check if PostgreSQL is running
if ! lsof -ti:5432 >/dev/null 2>&1; then
    echo "❌ PostgreSQL is not running on port 5432"
    echo "Please start PostgreSQL first:"
    echo "  brew services start postgresql@14"
    exit 1
fi
echo "✅ PostgreSQL running on port 5432"

# Check if Redis is running
if ! lsof -ti:6379 >/dev/null 2>&1; then
    echo "❌ Redis is not running on port 6379"
    echo "Please start Redis first:"
    echo "  brew services start redis"
    exit 1
fi
echo "✅ Redis running on port 6379"

# Start Backend Server
echo ""
echo "Starting Backend Server on port 8080..."
cd "$(dirname "$0")"
DB_USER=vigneshmac DB_PASSWORD="" DB_NAME=velocityllm ./bin/server > /tmp/velocityllm-backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Check if backend is running
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Backend server running on http://localhost:8080"
else
    echo "❌ Backend failed to start. Check /tmp/velocityllm-backend.log"
    exit 1
fi

# Start Frontend
echo ""
echo "Starting Frontend on port 3000..."
cd frontend
npm run dev > /tmp/velocityllm-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

sleep 3

# Check if frontend is running
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "✅ Frontend running on http://localhost:3000"
else
    echo "❌ Frontend failed to start. Check /tmp/velocityllm-frontend.log"
fi

echo ""
echo "======================================"
echo "✅ All Services Started Successfully!"
echo "======================================"
echo ""
echo "📊 Service URLs:"
echo "  Backend API:  http://localhost:8080"
echo "  Frontend UI:  http://localhost:3000"
echo "  Health Check: http://localhost:8080/health"
echo ""
echo "📝 Logs:"
echo "  Backend:  /tmp/velocityllm-backend.log"
echo "  Frontend: /tmp/velocityllm-frontend.log"
echo ""
echo "🛑 To stop services:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "🧪 To run tests:"
echo "  ./test_all_features.sh"
echo ""
