# VelocityLLM MCP Server

A **Model Context Protocol (MCP)** server that wraps VelocityLLM's REST API, enabling any MCP client (Claude Desktop, Cursor, etc.) to manage the LLM platform through natural language.

> **Three access layers:** Web UI → REST API → **MCP**

## Quick Start

```bash
# Install dependencies
cd mcp_server
pip install -r requirements.txt

# Set environment variables
export VELOCITYLLM_API_URL="http://localhost:8080"
export VELOCITYLLM_API_KEY="your-api-key"

# Run (stdio mode for Claude Desktop)
python -m mcp_server

# Or run with SSE for web clients
python -m mcp_server --transport sse --port 8081
```

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "velocityllm": {
      "command": "python",
      "args": ["-m", "mcp_server"],
      "cwd": "/path/to/velocityllm/mcp_server",
      "env": {
        "VELOCITYLLM_API_URL": "http://localhost:8080",
        "VELOCITYLLM_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector python -m mcp_server
```

## Available Tools (12)

| Tool | Description |
|------|-------------|
| `run_completion` | Run a prompt through any supported LLM model |
| `compare_models` | Compare multiple models side-by-side on the same prompt |
| `chat` | Multi-turn conversation through VelocityLLM |
| `search_knowledge_base` | Query the RAG knowledge base |
| `vector_search` | Semantic similarity search across vector collections |
| `render_prompt_template` | Render a prompt template with variables |
| `execute_workflow` | Execute an LLM workflow pipeline |
| `get_platform_health` | Check system health, workers, and uptime |
| `get_analytics` | Usage statistics, model breakdown, cost trends |
| `get_performance_metrics` | Latency percentiles, throughput, cache hit rates |
| `manage_api_keys` | List or create API keys |
| `get_billing_usage` | Current billing period usage and costs |

## Resources (4)

| URI | Description |
|-----|-------------|
| `velocityllm://models` | Available model catalog |
| `velocityllm://prompts` | Prompt template library |
| `velocityllm://workflows` | Workflow definitions |
| `velocityllm://analytics` | Analytics summary |

## Prompts (3)

| Prompt | Description |
|--------|-------------|
| `platform-status-report` | Comprehensive platform health + analytics report |
| `model-comparison` | Compare models for a specific task |
| `rag-deep-dive` | Research a topic using the knowledge base |

## Example Conversations

**With Claude Desktop:**
- "Check the platform health" → calls `get_platform_health`
- "Compare GPT-4 vs Claude on code generation" → calls `compare_models`
- "Search the knowledge base for authentication best practices" → calls `search_knowledge_base`
- "Create an API key called 'production'" → calls `manage_api_keys`
- "Give me a full platform status report" → uses `platform-status-report` prompt

## Architecture

```
Claude Desktop / Cursor
        │
        │ MCP (stdio/SSE)
        ▼
┌─────────────────┐
│  MCP Server     │  Python + mcp SDK
│  (this project) │
└────────┬────────┘
         │ HTTP/REST
         ▼
┌─────────────────┐
│  VelocityLLM    │  Go backend
│  Backend API    │
└─────────────────┘
```
