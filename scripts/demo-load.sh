#!/bin/bash
# ============================================================================
# VelocityLLM Demo Load Generator
# Fires real requests to populate dashboards with live data
# Usage: ./scripts/demo-load.sh [--quick | --full]
# ============================================================================

set -e

API_URL="${API_URL:-http://localhost:8080}"
MODE="${1:---quick}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

# Counters
TOTAL=0
SUCCESS=0
CACHED=0
FAILED=0

# Prompts for variety
PROMPTS_GPT=(
  "What is the capital of France?"
  "Explain quantum computing in one sentence."
  "Write a haiku about programming."
  "What is the time complexity of binary search?"
  "Summarize the theory of relativity in 20 words."
  "What is a goroutine in Go?"
  "Explain the CAP theorem briefly."
  "What is Docker used for?"
  "Name three sorting algorithms."
  "What is an API gateway?"
)

PROMPTS_CLAUDE=(
  "What is machine learning?"
  "Explain REST APIs in one sentence."
  "What is the difference between TCP and UDP?"
  "Describe microservices architecture briefly."
  "What is a load balancer?"
  "Explain OAuth 2.0 in simple terms."
  "What is a circuit breaker pattern?"
  "Define rate limiting in APIs."
  "What is eventual consistency?"
  "Explain the publish-subscribe pattern."
)

# Repeated prompts for cache hits
CACHE_PROMPTS=(
  "What is the capital of France?"
  "What is machine learning?"
  "Explain REST APIs in one sentence."
  "What is the time complexity of binary search?"
)

send_request() {
  local prompt="$1"
  local model="$2"
  local label="$3"

  TOTAL=$((TOTAL + 1))

  response=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}/api/v1/completions" \
    -H "Content-Type: application/json" \
    -d "{\"prompt\": \"${prompt}\", \"model\": \"${model}\", \"use_cache\": true, \"max_tokens\": 50, \"temperature\": 0.7}" \
    2>/dev/null)

  http_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | head -n -1)

  if [ "$http_code" = "200" ]; then
    latency=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('latency',0))" 2>/dev/null || echo "?")
    cost=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"{d.get('data',{}).get('cost',0):.6f}\")" 2>/dev/null || echo "?")
    cache=$(echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('cache_hit',False))" 2>/dev/null || echo "?")

    if [ "$cache" = "True" ]; then
      CACHED=$((CACHED + 1))
      printf "  ${CYAN}[CACHE]${NC} %-12s ${label}  ${CYAN}%sms${NC}  \$${cost}\n" "$model" "$latency"
    else
      SUCCESS=$((SUCCESS + 1))
      printf "  ${GREEN}[  OK ]${NC} %-12s ${label}  ${GREEN}%sms${NC}  \$${cost}\n" "$model" "$latency"
    fi
  else
    FAILED=$((FAILED + 1))
    printf "  ${RED}[FAIL ]${NC} %-12s ${label}  HTTP ${http_code}\n" "$model"
  fi
}

print_header() {
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}  VelocityLLM Demo Load Generator${NC}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  Mode: ${YELLOW}${MODE}${NC}  |  API: ${BLUE}${API_URL}${NC}"
  echo ""
}

print_summary() {
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  ${BOLD}Results${NC}"
  echo -e "  Total: ${BOLD}${TOTAL}${NC}  |  ${GREEN}Success: ${SUCCESS}${NC}  |  ${CYAN}Cached: ${CACHED}${NC}  |  ${RED}Failed: ${FAILED}${NC}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "  ${GREEN}Dashboards are now populated with real data!${NC}"
  echo -e "  Open ${BLUE}http://localhost:3000/dashboard${NC} to see live metrics."
  echo ""
}

# ============================================================================
# Quick mode: ~15 requests, fast demo
# ============================================================================
run_quick() {
  print_header

  echo -e "${YELLOW}Phase 1: OpenAI Requests (GPT-4)${NC}"
  for i in 0 1 2 3 4; do
    send_request "${PROMPTS_GPT[$i]}" "gpt-4" "\"${PROMPTS_GPT[$i]:0:40}...\""
  done

  echo ""
  echo -e "${YELLOW}Phase 2: Anthropic Requests (Claude)${NC}"
  for i in 0 1 2 3 4; do
    send_request "${PROMPTS_CLAUDE[$i]}" "claude-3-sonnet" "\"${PROMPTS_CLAUDE[$i]:0:40}...\""
  done

  echo ""
  echo -e "${YELLOW}Phase 3: Cache Hit Demonstration${NC}"
  for prompt in "${CACHE_PROMPTS[@]}"; do
    model="gpt-4"
    if [[ "$prompt" == "What is machine learning?" ]] || [[ "$prompt" == "Explain REST APIs"* ]]; then
      model="claude-3-sonnet"
    fi
    send_request "$prompt" "$model" "\"${prompt:0:40}...\" (repeat)"
  done

  print_summary
}

# ============================================================================
# Full mode: ~40 requests, comprehensive demo
# ============================================================================
run_full() {
  print_header

  echo -e "${YELLOW}Phase 1: OpenAI Requests (GPT-4) - 10 prompts${NC}"
  for i in "${!PROMPTS_GPT[@]}"; do
    send_request "${PROMPTS_GPT[$i]}" "gpt-4" "\"${PROMPTS_GPT[$i]:0:40}...\""
  done

  echo ""
  echo -e "${YELLOW}Phase 2: Anthropic Requests (Claude Sonnet) - 10 prompts${NC}"
  for i in "${!PROMPTS_CLAUDE[@]}"; do
    send_request "${PROMPTS_CLAUDE[$i]}" "claude-3-sonnet" "\"${PROMPTS_CLAUDE[$i]:0:40}...\""
  done

  echo ""
  echo -e "${YELLOW}Phase 3: Claude Haiku (Fast Model) - 5 prompts${NC}"
  for i in 0 1 2 3 4; do
    send_request "${PROMPTS_CLAUDE[$i]}" "claude-3-haiku" "\"${PROMPTS_CLAUDE[$i]:0:40}...\""
  done

  echo ""
  echo -e "${YELLOW}Phase 4: Cache Hit Demonstration - repeated prompts${NC}"
  for prompt in "${CACHE_PROMPTS[@]}"; do
    send_request "$prompt" "gpt-4" "\"${prompt:0:40}...\" (cache test)"
  done
  for prompt in "${CACHE_PROMPTS[@]}"; do
    send_request "$prompt" "claude-3-sonnet" "\"${prompt:0:40}...\" (cache test)"
  done

  echo ""
  echo -e "${YELLOW}Phase 5: Mixed Traffic Burst${NC}"
  models=("gpt-4" "claude-3-sonnet" "claude-3-haiku" "gpt-4" "claude-3-sonnet")
  for i in 0 1 2 3 4; do
    idx=$((RANDOM % ${#PROMPTS_GPT[@]}))
    send_request "${PROMPTS_GPT[$idx]}" "${models[$i]}" "\"${PROMPTS_GPT[$idx]:0:40}...\" (burst)"
  done

  print_summary
}

# ============================================================================
# Main
# ============================================================================

# Check if server is running
if ! curl -s "${API_URL}/health" > /dev/null 2>&1; then
  echo -e "${RED}Error: Backend not running at ${API_URL}${NC}"
  echo -e "Start it with: ${BLUE}./start-all.sh${NC}"
  exit 1
fi

case "$MODE" in
  --quick|-q)
    run_quick
    ;;
  --full|-f)
    run_full
    ;;
  *)
    echo "Usage: $0 [--quick | --full]"
    echo "  --quick, -q   ~15 requests (fast demo)"
    echo "  --full,  -f   ~40 requests (comprehensive demo)"
    exit 1
    ;;
esac
