#!/bin/bash

# VelocityLLM End-to-End Test Script (Days 1-9)
# ============================================

BASE_URL="http://localhost:8080"
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

echo -e "${BOLD}===========================================${NC}"
echo -e "${BOLD}VelocityLLM End-to-End Testing (Days 1-9)${NC}"
echo -e "${BOLD}===========================================${NC}\n"

# Helper function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"

    test_count=$((test_count + 1))
    echo -n "[$test_count] Testing $name... "

    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -X POST -H "Content-Type: application/json" -d "$data" -w "\n%{http_code}" "$BASE_URL$endpoint")
    fi

    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        pass_count=$((pass_count + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $http_code)"
        fail_count=$((fail_count + 1))
        return 1
    fi
}

echo -e "${BOLD}=== Day 1-3: Core API Endpoints ===${NC}\n"

# Health check
test_endpoint "Health Check" "GET" "/health" "" "200"

# Models API
test_endpoint "List Models" "GET" "/api/v1/models" "" "200"

# Requests API
test_endpoint "List Requests" "GET" "/api/v1/requests" "" "200"
test_endpoint "Request Stats" "GET" "/api/v1/requests/stats" "" "200"

echo -e "\n${BOLD}=== Day 2: Cache Endpoints ===${NC}\n"

test_endpoint "Cache Stats" "GET" "/api/v1/cache/stats" "" "200"

echo -e "\n${BOLD}=== Day 4: Router Endpoints ===${NC}\n"

test_endpoint "Router Stats" "GET" "/api/v1/router/stats" "" "200"
test_endpoint "Router Config" "GET" "/api/v1/router/config" "" "200"
test_endpoint "Circuit Breakers" "GET" "/api/v1/router/circuit-breakers" "" "200"
test_endpoint "Health Stats" "GET" "/api/v1/router/health/stats" "" "200"

echo -e "\n${BOLD}=== Day 5: Worker Pool & Metrics ===${NC}\n"

test_endpoint "Worker Stats" "GET" "/api/v1/workers/stats" "" "200"
test_endpoint "Worker Health" "GET" "/api/v1/workers/health" "" "200"
test_endpoint "Queue Info" "GET" "/api/v1/workers/queue" "" "200"
test_endpoint "Metrics Snapshot" "GET" "/api/v1/metrics/snapshot" "" "200"
test_endpoint "Latency Metrics" "GET" "/api/v1/metrics/latency" "" "200"
test_endpoint "Cost Metrics" "GET" "/api/v1/metrics/cost" "" "200"
test_endpoint "System Health" "GET" "/api/v1/system/health" "" "200"

echo -e "\n${BOLD}=== Day 5: Optimization Endpoints ===${NC}\n"

test_endpoint "DB Pool Stats" "GET" "/api/v1/optimization/pools/db" "" "200"
test_endpoint "Redis Pool Stats" "GET" "/api/v1/optimization/pools/redis" "" "200"
test_endpoint "HTTP Pool Stats" "GET" "/api/v1/optimization/pools/http" "" "200"
test_endpoint "All Pool Stats" "GET" "/api/v1/optimization/pools" "" "200"
test_endpoint "Batcher Stats" "GET" "/api/v1/optimization/batcher/stats" "" "200"

echo -e "\n${BOLD}=== Day 6: Streaming Endpoints ===${NC}\n"

test_endpoint "Stream Stats" "GET" "/api/v1/streaming/stats" "" "200"
test_endpoint "SSE Test" "GET" "/api/v1/streaming/test" "" "200"

echo -e "\n${BOLD}===========================================${NC}"
echo -e "${BOLD}Test Summary${NC}"
echo -e "${BOLD}===========================================${NC}"
echo -e "Total Tests: $test_count"
echo -e "${GREEN}Passed: $pass_count${NC}"
echo -e "${RED}Failed: $fail_count${NC}"

if [ $fail_count -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}✓ ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "\n${RED}${BOLD}✗ SOME TESTS FAILED${NC}"
    exit 1
fi
