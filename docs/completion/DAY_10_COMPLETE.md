# Day 10: Context & Token Management - COMPLETE ✅

## Implementation Date
February 11, 2026

## Overview
Implemented comprehensive token counting, context management, and intelligent budget allocation system for optimizing LLM request handling.

## Components Implemented

### 1. Token Counter (`internal/tokens/counter.go`)
**Purpose**: Accurate token counting and text manipulation based on token limits

#### Core Features:
- **Token Counting**: Estimation algorithm (~0.75 tokens per word)
- **Message Counting**: Calculate tokens for conversation arrays
- **Response Estimation**: Predict token requirements for responses
- **Context Fitting**: Check if text fits within token limits
- **Smart Truncation**: Binary search-based text truncation
- **Caching**: Thread-safe token count caching for performance

#### Key Methods:
```go
Count(text string) int                          // Count tokens in text
CountMessages(messages []Message) int           // Count tokens in message array
EstimateResponseTokens(prompt, max int) int    // Estimate response tokens
WillFitInContext(text string, limit int) bool  // Check token limit
TruncateToFit(text string, limit int) string   // Truncate to fit limit
```

#### Optimizations:
- In-memory cache for repeated text
- Fast word counting with `strings.Fields()`
- Special character detection for accuracy
- Singleton pattern for global access

### 2. Context Manager (`internal/tokens/context.go`)
**Purpose**: Manage conversation contexts with automatic token budget enforcement

#### Context Structure:
```go
type Context struct {
    ID           string                    // Unique context identifier
    Messages     []Message                 // Conversation history
    TotalTokens  int                       // Current token count
    MaxTokens    int                       // Token budget limit
    CreatedAt    time.Time                // Creation timestamp
    LastAccessed time.Time                // Last access time
    SystemPrompt string                   // System-level prompt
    Metadata     map[string]interface{}   // Custom metadata
}
```

#### Features:
- **Context Creation**: Initialize conversation contexts with token limits
- **Message Management**: Add messages with automatic truncation
- **Token Tracking**: Real-time token count updates
- **Auto-Truncation**: Preserve recent messages when hitting limits
- **System Prompt Protection**: Always preserve system messages
- **Cleanup**: Automatic expiration of old contexts
- **Statistics**: Track contexts, messages, and token usage

#### Intelligent Truncation:
- Preserves system prompt (always first)
- Removes oldest user/assistant messages first
- Keeps most recent conversation intact
- Maintains token budget compliance

#### Auto-Cleanup:
- Configurable max context age (default: 30 minutes)
- Periodic cleanup interval (default: 5 minutes)
- Automatic removal of stale contexts
- Statistics tracking for expired contexts

### 3. Budget Allocator (`internal/tokens/budget.go`)
**Purpose**: Intelligent distribution of token budgets across request components

#### Allocation Structure:
```go
type Allocation struct {
    TotalBudget    int  // Total available tokens
    SystemTokens   int  // Allocated for system prompt
    PromptTokens   int  // Allocated for user prompt
    ContextTokens  int  // Allocated for conversation history
    ResponseTokens int  // Allocated for LLM response
    ReserveTokens  int  // Safety reserve
    Used           int  // Actually used tokens
}
```

#### Default Allocation Ratio:
- **System**: 5% - System prompts and instructions
- **Prompt**: 30% - User's input prompt
- **Context**: 15% - Conversation history
- **Response**: 45% - LLM response generation
- **Reserve**: 5% - Safety buffer for overhead

#### Features:
- **Custom Ratios**: Override defaults per request
- **Dynamic Optimization**: Redistribute unused budget to response
- **Budget Tracking**: Monitor token usage in real-time
- **Validation**: Ensure ratios sum to 100%
- **Multi-Request**: Handle multiple allocations concurrently

#### Budget Optimization:
```go
// After measuring actual usage, optimize allocation
OptimizeAllocation(requestID, actualSystem, actualPrompt, actualContext int)
// Redistributes remaining budget to response tokens
```

## API Endpoints (14 New)

### Token Operations (4 endpoints)
1. **POST /api/v1/tokens/count** - Count tokens in text
2. **POST /api/v1/tokens/truncate** - Truncate text to token limit
3. **GET /api/v1/tokens/estimate** - Estimate response token requirements
4. **GET /api/v1/tokens/cache** - Get token counter cache statistics

### Context Management (7 endpoints)
5. **POST /api/v1/context/create** - Create new conversation context
6. **GET /api/v1/context/get** - Retrieve context with messages
7. **POST /api/v1/context/message** - Add message to context
8. **POST /api/v1/context/clear** - Clear context messages
9. **DELETE /api/v1/context/delete** - Delete context completely
10. **GET /api/v1/context/list** - List all active contexts
11. **GET /api/v1/context/stats** - Get context manager statistics

### Budget Allocation (3 endpoints)
12. **POST /api/v1/budget/allocate** - Allocate token budget
13. **GET /api/v1/budget/get** - Get budget breakdown
14. **POST /api/v1/budget/use** - Mark tokens as used

## Files Created/Modified

### New Files (4)
1. `internal/tokens/counter.go` - 175 lines
2. `internal/tokens/context.go` - 426 lines
3. `internal/tokens/budget.go` - 287 lines
4. `internal/api/tokens_handlers.go` - 361 lines

### Modified Files (2)
1. `internal/api/router.go` - Added 14 endpoint registrations
2. `cmd/server/main.go` - Added tokens import and context manager initialization

**Total New Code**: ~1,249 lines

## Technical Implementation

### Token Counting Algorithm
```
1. Split text into words (whitespace-delimited)
2. Calculate word count
3. Apply multiplier: tokens ≈ words × 0.75
4. Count special characters (punctuation, symbols)
5. Add special char overhead: tokens += specialChars / 4
6. Cache result for future lookups
```

### Context Window Management
```
1. Receive new message
2. Calculate message tokens (content + role + formatting)
3. Check if adding exceeds max tokens
4. If exceeds:
   - Keep system message (if present)
   - Remove oldest messages until budget met
   - Preserve most recent conversation
5. Add new message
6. Update total token count
7. Update last accessed timestamp
```

### Budget Allocation Flow
```
1. Request arrives with total token budget
2. Apply allocation ratio (default or custom):
   - System: 5% of total
   - Prompt: 30% of total
   - Context: 15% of total
   - Response: 45% of total
   - Reserve: 5% of total
3. Track actual token usage
4. Optimize allocation:
   - Measure actual system/prompt/context usage
   - Redistribute unused budget to response
   - Maintain safety reserve
5. Validate budget not exceeded
```

## Statistics Tracked

### Token Counter Stats
- Cache size (number of cached texts)
- Cache hit rate (implicit)

### Context Manager Stats
- Total contexts created
- Currently active contexts
- Total messages added
- Total tokens processed
- Contexts expired (auto-cleanup)
- Messages truncated (budget enforcement)

### Budget Allocator Stats
- Active allocations
- Per-allocation breakdown
- Budget utilization rates
- Remaining budgets

## Configuration

### Context Manager Config
```go
ContextConfig{
    MaxContextAge:     30 * time.Minute,  // Expire after 30min
    CleanupInterval:   5 * time.Minute,   // Cleanup every 5min
    DefaultMaxTokens:  4096,               // 4K token default limit
    EnableAutoCleanup: true,               // Auto-expire old contexts
}
```

### Custom Allocation Ratio
```go
AllocationRatio{
    System:   0.10,  // 10% for system
    Prompt:   0.35,  // 35% for prompt
    Context:  0.10,  // 10% for context
    Response: 0.40,  // 40% for response
    Reserve:  0.05,  // 5% reserve
}
```

## Integration Points

### With Completions (Days 1-3)
- Token counting before API calls
- Budget allocation for requests
- Response estimation for max_tokens

### With Streaming (Day 6)
- Track tokens in streaming responses
- Stop streaming at token limits
- Budget enforcement during streaming

### With Prompts (Day 9)
- Count template tokens
- Truncate templates to fit budgets
- Allocate tokens for prompt variations

### With Metrics (Day 5)
- Track token usage patterns
- Monitor budget utilization
- Analyze truncation frequency

## Use Cases

### 1. Conversation Management
```bash
# Create context with 2K token limit
curl -X POST http://localhost:8080/api/v1/context/create \
  -d '{"context_id": "conv1", "max_tokens": 2000, "system_prompt": "You are a helpful assistant"}'

# Add user message
curl -X POST http://localhost:8080/api/v1/context/message \
  -d '{"context_id": "conv1", "role": "user", "content": "Hello!"}'

# Add assistant response
curl -X POST http://localhost:8080/api/v1/context/message \
  -d '{"context_id": "conv1", "role": "assistant", "content": "Hi! How can I help?"}'
```

### 2. Budget Planning
```bash
# Allocate 8K token budget with default ratios
curl -X POST http://localhost:8080/api/v1/budget/allocate \
  -d '{"request_id": "req123", "total_tokens": 8192}'

# Returns:
# {
#   "system": 410,    // 5%
#   "prompt": 2458,   // 30%
#   "context": 1229,  // 15%
#   "response": 3686, // 45%
#   "reserve": 410    // 5%
# }
```

### 3. Token Optimization
```bash
# Count tokens before sending
curl -X POST http://localhost:8080/api/v1/tokens/count \
  -d '{"text": "Your very long text here..."}'

# Truncate if too long
curl -X POST http://localhost:8080/api/v1/tokens/truncate \
  -d '{"text": "Very long text...", "limit": 100}'
```

## Performance Optimizations

### 1. Token Counting Cache
- Caches previously counted texts
- Thread-safe concurrent access
- Reduces redundant calculations
- Significant speedup for repeated text

### 2. Binary Search Truncation
- O(log n) complexity for truncation
- Efficient for large texts
- Preserves word boundaries
- Adds ellipsis when truncated

### 3. Lock Optimization
- RWMutex for read-heavy workloads
- Fine-grained locking per context
- Minimal lock contention
- Concurrent context access

## Thread Safety

All components are fully thread-safe:
- **TokenCounter**: RWMutex for cache access
- **ContextManager**: RWMutex for context map, per-context locks for messages
- **BudgetAllocator**: RWMutex for allocations map, per-allocation locks for updates

## Limitations & Future Improvements

### Current Limitations:
1. **Token Counting**: Estimation-based, not exact (production should use tiktoken)
2. **No Persistence**: Contexts lost on restart (could add Redis/DB persistence)
3. **Memory-Only**: All contexts stored in memory (scalability limit)

### Future Enhancements:
1. **Exact Tokenization**: Integrate tiktoken for GPT models
2. **Model-Specific**: Different counting for GPT-3.5, GPT-4, Claude, etc.
3. **Persistent Contexts**: Store contexts in Redis or database
4. **Context Compression**: Summarize old messages instead of truncating
5. **Smart Truncation**: Use semantic similarity to keep important messages
6. **Budget Learning**: ML-based allocation ratio optimization

## Testing Checklist

- [x] Token counting works
- [x] Message token counting
- [x] Text truncation
- [x] Response estimation
- [x] Context creation
- [x] Message addition with auto-truncation
- [x] System prompt preservation
- [x] Context cleanup
- [x] Budget allocation
- [x] Custom allocation ratios
- [x] Budget optimization
- [x] Thread-safe operations
- [x] API endpoints defined
- [x] Integration in main.go
- [x] Build succeeds

## Example Scenarios

### Scenario 1: Long Conversation
```
1. User creates context with 4K token limit
2. Over time, 20 messages exchanged (6K tokens)
3. Context manager auto-truncates to 4K
4. Keeps system prompt + most recent 10-12 messages
5. Old messages removed from beginning
```

### Scenario 2: Budget Optimization
```
1. Request allocated 8K tokens (default ratios)
2. System uses 200 tokens (allocated 410)
3. Prompt uses 1500 tokens (allocated 2458)
4. Context uses 800 tokens (allocated 1229)
5. Optimization runs:
   - 210 saved from system
   - 958 saved from prompt
   - 429 saved from context
   - Total 1597 tokens
6. Response budget increases: 3686 + 1597 = 5283 tokens
```

### Scenario 3: Context Expiration
```
1. User creates context at 10:00 AM
2. Last message at 10:05 AM
3. Context inactive for 30 minutes
4. Cleanup runs at 10:40 AM
5. Context auto-deleted (max age: 30m)
6. Statistics updated: ContextsExpired++
```

## Integration with Existing Systems

### Router Integration (Day 4)
- Token counting for model selection
- Budget allocation per model
- Route based on token limits

### Caching Integration (Day 7)
- Cache token counts
- Cache context snapshots
- Semantic cache with token awareness

### Metrics Integration (Day 5)
- Track token usage trends
- Monitor budget efficiency
- Alert on high truncation rates

## Next Steps (Day 11)
- Frontend Dashboard Development
- React components for metrics visualization
- Real-time monitoring UI
- Token usage charts

## Notes
- Simplified token counting (production needs tiktoken)
- Context manager handles concurrent access safely
- Budget allocator optimizes unused tokens
- All components singleton pattern for global access
- Auto-cleanup prevents memory leaks
- Thread-safe for production use
