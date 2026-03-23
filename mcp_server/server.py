"""
VelocityLLM MCP Server

Exposes the VelocityLLM platform as an MCP server with:
- 12 Tools  (actions: completions, chat, RAG, workflows, keys, billing, etc.)
- 4  Resources (read-only data: models, prompts, workflows, analytics)
- 3  Prompts (pre-built templates for common tasks)

Run with:
    python -m mcp_server                     # stdio (Claude Desktop)
    python -m mcp_server --transport sse     # SSE  (web clients)
"""

import argparse
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from mcp.server import Server
from mcp.types import (
    GetPromptResult,
    PromptArgument,
    PromptMessage,
    Resource,
    TextContent,
    Tool,
)

from mcp_server.client import VelocityLLMClient
from mcp_server.config import Config

logger = logging.getLogger("velocityllm-mcp")

# ═══════════════════════════════════════════════════════════════════
# Lifespan — initialize/tear down the API client
# ═══════════════════════════════════════════════════════════════════

_client: VelocityLLMClient | None = None


def _get_client() -> VelocityLLMClient:
    assert _client is not None, "VelocityLLMClient not initialized"
    return _client


@asynccontextmanager
async def lifespan(_server: Server) -> AsyncIterator[None]:
    global _client
    config = Config.from_env()
    _client = VelocityLLMClient(config)
    logger.info("Connected to VelocityLLM at %s", config.api_url)
    try:
        yield
    finally:
        await _client.close()
        _client = None


# ═══════════════════════════════════════════════════════════════════
# Server instance
# ═══════════════════════════════════════════════════════════════════

server = Server("velocityllm", lifespan=lifespan)


def _json(data: Any) -> list[TextContent]:
    """Format any data as a JSON TextContent response."""
    return [TextContent(type="text", text=json.dumps(data, indent=2, default=str))]


# ═══════════════════════════════════════════════════════════════════
# TOOLS — 12 actions exposed to MCP clients
# ═══════════════════════════════════════════════════════════════════

TOOLS: list[Tool] = [
    Tool(
        name="run_completion",
        description="Run a prompt through VelocityLLM and get a completion from any supported LLM model.",
        inputSchema={
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "The prompt text"},
                "model": {"type": "string", "description": "Model ID (e.g. gpt-4, claude-sonnet-4-20250514)", "default": "gpt-4"},
                "max_tokens": {"type": "integer", "description": "Maximum tokens to generate", "default": 1024},
                "temperature": {"type": "number", "description": "Sampling temperature (0-2)", "default": 0.7},
            },
            "required": ["prompt"],
        },
    ),
    Tool(
        name="compare_models",
        description="Compare multiple models side-by-side on the same prompt. Returns responses from each model for easy comparison.",
        inputSchema={
            "type": "object",
            "properties": {
                "prompt": {"type": "string", "description": "The prompt to send to all models"},
                "models": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of model IDs to compare (e.g. ['gpt-4', 'claude-sonnet-4-20250514'])",
                },
                "max_tokens": {"type": "integer", "default": 512},
            },
            "required": ["prompt", "models"],
        },
    ),
    Tool(
        name="chat",
        description="Have a multi-turn conversation through VelocityLLM. Creates a new conversation or continues an existing one.",
        inputSchema={
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "The message to send"},
                "conversation_id": {"type": "string", "description": "Existing conversation ID to continue (omit to start new)"},
                "model": {"type": "string", "default": "gpt-4"},
            },
            "required": ["message"],
        },
    ),
    Tool(
        name="search_knowledge_base",
        description="Query the RAG knowledge base to find relevant documents and get an AI-synthesized answer.",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"},
                "top_k": {"type": "integer", "description": "Number of results to retrieve", "default": 5},
            },
            "required": ["query"],
        },
    ),
    Tool(
        name="vector_search",
        description="Perform semantic similarity search across vector collections.",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "The search query"},
                "collection": {"type": "string", "description": "Vector collection name", "default": "default"},
                "top_k": {"type": "integer", "default": 5},
            },
            "required": ["query"],
        },
    ),
    Tool(
        name="render_prompt_template",
        description="Render a prompt template from the library with provided variables.",
        inputSchema={
            "type": "object",
            "properties": {
                "template_id": {"type": "string", "description": "ID of the prompt template"},
                "variables": {"type": "object", "description": "Key-value pairs to fill into the template"},
            },
            "required": ["template_id", "variables"],
        },
    ),
    Tool(
        name="execute_workflow",
        description="Execute an LLM workflow pipeline (chained/parallel/conditional model calls).",
        inputSchema={
            "type": "object",
            "properties": {
                "workflow_id": {"type": "string", "description": "ID of the workflow to execute"},
                "inputs": {"type": "object", "description": "Input data for the workflow", "default": {}},
            },
            "required": ["workflow_id"],
        },
    ),
    Tool(
        name="get_platform_health",
        description="Check VelocityLLM platform health including API status, worker pool, and system metrics.",
        inputSchema={"type": "object", "properties": {}},
    ),
    Tool(
        name="get_analytics",
        description="Get platform analytics: request counts, model usage, cost breakdown, and trends.",
        inputSchema={"type": "object", "properties": {}},
    ),
    Tool(
        name="get_performance_metrics",
        description="Get detailed performance metrics: latency percentiles, throughput, cache hit rates, and error rates.",
        inputSchema={"type": "object", "properties": {}},
    ),
    Tool(
        name="manage_api_keys",
        description="List existing API keys or create a new one.",
        inputSchema={
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["list", "create"], "description": "Action to perform"},
                "name": {"type": "string", "description": "Name for the new key (required when action=create)"},
                "tier": {"type": "string", "enum": ["free", "pro", "enterprise"], "default": "free"},
            },
            "required": ["action"],
        },
    ),
    Tool(
        name="get_billing_usage",
        description="Get current billing period usage, costs, and quota consumption.",
        inputSchema={"type": "object", "properties": {}},
    ),
]


@server.list_tools()
async def list_tools() -> list[Tool]:
    return TOOLS


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    c = _get_client()

    try:
        if name == "run_completion":
            result = await c.run_completion(
                prompt=arguments["prompt"],
                model=arguments.get("model", "gpt-4"),
                max_tokens=arguments.get("max_tokens", 1024),
                temperature=arguments.get("temperature", 0.7),
            )

        elif name == "compare_models":
            requests = [
                {"prompt": arguments["prompt"], "model": m, "max_tokens": arguments.get("max_tokens", 512)}
                for m in arguments["models"]
            ]
            result = await c.run_batch_completions(requests)

        elif name == "chat":
            conv_id = arguments.get("conversation_id")
            if not conv_id:
                conv = await c.create_conversation("MCP Chat")
                conv_id = conv.get("id") if isinstance(conv, dict) else conv
            result = await c.send_message(
                conversation_id=str(conv_id),
                message=arguments["message"],
                model=arguments.get("model", "gpt-4"),
            )

        elif name == "search_knowledge_base":
            result = await c.rag_query(
                query=arguments["query"],
                top_k=arguments.get("top_k", 5),
            )

        elif name == "vector_search":
            result = await c.vector_search(
                query=arguments["query"],
                collection=arguments.get("collection", "default"),
                top_k=arguments.get("top_k", 5),
            )

        elif name == "render_prompt_template":
            result = await c.render_prompt(
                template_id=arguments["template_id"],
                variables=arguments["variables"],
            )

        elif name == "execute_workflow":
            result = await c.execute_workflow(
                workflow_id=arguments["workflow_id"],
                inputs=arguments.get("inputs", {}),
            )

        elif name == "get_platform_health":
            health = await c.get_health()
            workers = await c.get_worker_metrics()
            result = {"health": health, "workers": workers}

        elif name == "get_analytics":
            result = await c.get_analytics_dashboard()

        elif name == "get_performance_metrics":
            metrics = await c.get_metrics_snapshot()
            cache = await c.get_cache_stats()
            result = {"metrics": metrics, "cache": cache}

        elif name == "manage_api_keys":
            action = arguments["action"]
            if action == "create":
                if "name" not in arguments:
                    return _json({"error": "name is required when action=create"})
                result = await c.create_api_key(
                    name=arguments["name"],
                    tier=arguments.get("tier", "free"),
                )
            else:
                result = await c.list_api_keys()

        elif name == "get_billing_usage":
            result = await c.get_billing_usage()

        else:
            return _json({"error": f"Unknown tool: {name}"})

        return _json(result)

    except httpx.HTTPStatusError as e:
        return _json({"error": f"API error {e.response.status_code}", "detail": e.response.text})
    except httpx.ConnectError:
        return _json({"error": "Cannot connect to VelocityLLM backend. Is it running?"})
    except Exception as e:
        return _json({"error": str(e)})


# ═══════════════════════════════════════════════════════════════════
# RESOURCES — 4 read-only data sources
# ═══════════════════════════════════════════════════════════════════

RESOURCES = [
    Resource(uri="velocityllm://models", name="Model Catalog", description="Available LLM models and their capabilities", mimeType="application/json"),
    Resource(uri="velocityllm://prompts", name="Prompt Library", description="Reusable prompt templates", mimeType="application/json"),
    Resource(uri="velocityllm://workflows", name="Workflow Definitions", description="LLM workflow pipelines", mimeType="application/json"),
    Resource(uri="velocityllm://analytics", name="Analytics Summary", description="Platform usage analytics", mimeType="application/json"),
]


@server.list_resources()
async def list_resources() -> list[Resource]:
    return RESOURCES


@server.read_resource()
async def read_resource(uri: str) -> str:
    c = _get_client()
    uri_str = str(uri)

    try:
        if uri_str == "velocityllm://models":
            data = await c.list_models()
        elif uri_str == "velocityllm://prompts":
            data = await c.list_prompt_templates()
        elif uri_str == "velocityllm://workflows":
            data = await c.list_workflows()
        elif uri_str == "velocityllm://analytics":
            data = await c.get_analytics_summary()
        else:
            data = {"error": f"Unknown resource: {uri_str}"}
    except Exception as e:
        data = {"error": str(e)}

    return json.dumps(data, indent=2, default=str)


# ═══════════════════════════════════════════════════════════════════
# PROMPTS — 3 pre-built prompt templates
# ═══════════════════════════════════════════════════════════════════

@server.list_prompts()
async def list_prompts() -> list[dict]:
    return [
        {
            "name": "platform-status-report",
            "description": "Generate a comprehensive VelocityLLM platform status report by combining health, analytics, and performance data.",
            "arguments": [],
        },
        {
            "name": "model-comparison",
            "description": "Compare LLM models for a specific task. Analyzes strengths, weaknesses, latency, and cost.",
            "arguments": [
                PromptArgument(name="task", description="The task or use case to compare models for", required=True),
                PromptArgument(name="models", description="Comma-separated model IDs (e.g. 'gpt-4,claude-sonnet-4-20250514')", required=False),
            ],
        },
        {
            "name": "rag-deep-dive",
            "description": "Research a topic thoroughly using the RAG knowledge base, synthesizing findings into a report.",
            "arguments": [
                PromptArgument(name="topic", description="The topic to research", required=True),
            ],
        },
    ]


@server.get_prompt()
async def get_prompt(name: str, arguments: dict[str, str] | None = None) -> GetPromptResult:
    arguments = arguments or {}

    if name == "platform-status-report":
        return GetPromptResult(
            description="Generate a VelocityLLM platform status report",
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(
                        type="text",
                        text=(
                            "Generate a comprehensive status report for the VelocityLLM platform. "
                            "Use these tools to gather data:\n\n"
                            "1. Call `get_platform_health` to check system health and worker status\n"
                            "2. Call `get_analytics` to get usage statistics and trends\n"
                            "3. Call `get_performance_metrics` to get latency, throughput, and cache data\n\n"
                            "Then synthesize all the data into a well-structured report with sections for:\n"
                            "- Executive Summary (1-2 sentences)\n"
                            "- System Health (API status, worker pool, uptime)\n"
                            "- Usage Analytics (requests, active models, cost)\n"
                            "- Performance (latency p50/p95/p99, cache hit rate, error rate)\n"
                            "- Recommendations (if any issues found)\n\n"
                            "Format with markdown headers and use tables where appropriate."
                        ),
                    ),
                )
            ],
        )

    elif name == "model-comparison":
        task = arguments.get("task", "general text generation")
        models = arguments.get("models", "gpt-4,claude-sonnet-4-20250514")
        model_list = [m.strip() for m in models.split(",")]

        return GetPromptResult(
            description=f"Compare models for: {task}",
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(
                        type="text",
                        text=(
                            f"Compare these LLM models for the task: **{task}**\n\n"
                            f"Models to compare: {', '.join(model_list)}\n\n"
                            "Steps:\n"
                            f"1. Use `compare_models` with a representative prompt for '{task}' "
                            f"and models {json.dumps(model_list)}\n"
                            "2. Use `get_performance_metrics` to get latency data per model\n"
                            "3. Browse the `velocityllm://models` resource for model capabilities\n\n"
                            "Then provide a comparison table with:\n"
                            "| Model | Quality | Latency | Cost/1K tokens | Best For |\n"
                            "And a recommendation for which model to use for this task and why."
                        ),
                    ),
                )
            ],
        )

    elif name == "rag-deep-dive":
        topic = arguments.get("topic", "")
        return GetPromptResult(
            description=f"Deep dive research on: {topic}",
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(
                        type="text",
                        text=(
                            f"Research the topic **{topic}** using VelocityLLM's knowledge base.\n\n"
                            "Steps:\n"
                            f"1. Use `search_knowledge_base` with query: '{topic}'\n"
                            f"2. Use `vector_search` for semantic search on: '{topic}'\n"
                            "3. If relevant prompt templates exist, check `velocityllm://prompts`\n\n"
                            "Synthesize findings into a research report with:\n"
                            "- Key Findings (bullet points)\n"
                            "- Relevant Documents (with source references)\n"
                            "- Knowledge Gaps (what's NOT in the knowledge base)\n"
                            "- Suggested Follow-ups"
                        ),
                    ),
                )
            ],
        )

    else:
        return GetPromptResult(
            description="Unknown prompt",
            messages=[
                PromptMessage(
                    role="user",
                    content=TextContent(type="text", text=f"Unknown prompt: {name}"),
                )
            ],
        )


# ═══════════════════════════════════════════════════════════════════
# Main entry point
# ═══════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(description="VelocityLLM MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse"],
        default="stdio",
        help="Transport protocol (default: stdio for Claude Desktop)",
    )
    parser.add_argument("--port", type=int, default=8081, help="Port for SSE transport")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    if args.transport == "sse":
        from mcp.server.sse import SseServerTransport
        from starlette.applications import Starlette
        from starlette.routing import Mount, Route
        import uvicorn

        sse = SseServerTransport("/messages/")

        async def handle_sse(request):
            async with sse.connect_sse(request.scope, request.receive, request._send) as streams:
                await server.run(streams[0], streams[1], server.create_initialization_options())

        app = Starlette(
            routes=[
                Route("/sse", endpoint=handle_sse),
                Mount("/messages/", app=sse.handle_post_message),
            ],
        )
        uvicorn.run(app, host="0.0.0.0", port=args.port)
    else:
        from mcp.server.stdio import stdio_server

        async def run_stdio():
            async with stdio_server() as streams:
                await server.run(streams[0], streams[1], server.create_initialization_options())

        asyncio.run(run_stdio())


if __name__ == "__main__":
    main()
