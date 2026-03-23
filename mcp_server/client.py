"""Async HTTP client for the VelocityLLM REST API."""

from typing import Any

import httpx

from mcp_server.config import Config


class VelocityLLMClient:
    """Wraps VelocityLLM's Go backend API with async HTTP calls."""

    def __init__(self, config: Config) -> None:
        self._config = config
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if config.api_key:
            headers["Authorization"] = f"Bearer {config.api_key}"
        self._http = httpx.AsyncClient(
            base_url=config.api_url,
            headers=headers,
            timeout=30.0,
        )

    async def close(self) -> None:
        await self._http.aclose()

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        """Make a request and unwrap the standard API envelope."""
        resp = await self._http.request(method, path, **kwargs)
        resp.raise_for_status()
        data = resp.json()
        # Unwrap {"success": true, "data": ...} envelope if present
        if isinstance(data, dict) and "data" in data:
            return data["data"]
        return data

    async def _get(self, path: str, **params: Any) -> Any:
        return await self._request("GET", path, params=params or None)

    async def _post(self, path: str, body: dict | None = None) -> Any:
        return await self._request("POST", path, json=body)

    # ── Completions ──────────────────────────────────────────────

    async def run_completion(
        self,
        prompt: str,
        model: str = "gpt-4",
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> Any:
        return await self._post(
            "/api/v1/completions",
            {"prompt": prompt, "model": model, "max_tokens": max_tokens, "temperature": temperature},
        )

    async def run_batch_completions(self, prompts: list[dict]) -> Any:
        return await self._post("/api/v1/completions/batch", {"requests": prompts})

    # ── Chat ─────────────────────────────────────────────────────

    async def create_conversation(self, title: str = "MCP Chat") -> Any:
        return await self._post("/api/v1/chat/conversations", {"title": title})

    async def send_message(self, conversation_id: str, message: str, model: str = "gpt-4") -> Any:
        return await self._post(
            f"/api/v1/chat/conversations/{conversation_id}/send",
            {"message": message, "model": model},
        )

    async def list_conversations(self) -> Any:
        return await self._get("/api/v1/chat/conversations")

    # ── RAG ──────────────────────────────────────────────────────

    async def rag_query(self, query: str, top_k: int = 5) -> Any:
        return await self._post("/api/v1/rag/query", {"query": query, "top_k": top_k})

    # ── Vectors ──────────────────────────────────────────────────

    async def vector_search(self, query: str, collection: str = "default", top_k: int = 5) -> Any:
        return await self._get(
            "/api/v1/vectors/search",
            query=query,
            collection=collection,
            top_k=top_k,
        )

    # ── Prompts ──────────────────────────────────────────────────

    async def list_prompt_templates(self) -> Any:
        return await self._get("/api/v1/prompts/templates")

    async def render_prompt(self, template_id: str, variables: dict) -> Any:
        return await self._post(
            "/api/v1/prompts/render",
            {"template_id": template_id, "variables": variables},
        )

    # ── Workflows ────────────────────────────────────────────────

    async def list_workflows(self) -> Any:
        return await self._get("/api/v1/workflows/workflows")

    async def execute_workflow(self, workflow_id: str, inputs: dict | None = None) -> Any:
        return await self._post(
            "/api/v1/workflows/workflows/execute",
            {"workflow_id": workflow_id, "inputs": inputs or {}},
        )

    # ── Health & Metrics ─────────────────────────────────────────

    async def get_health(self) -> Any:
        return await self._get("/health")

    async def get_worker_metrics(self) -> Any:
        return await self._get("/api/v1/workers/metrics")

    async def get_metrics_snapshot(self) -> Any:
        return await self._get("/api/v1/metrics/snapshot")

    async def get_cache_stats(self) -> Any:
        return await self._get("/api/v1/cache/stats")

    # ── Analytics ────────────────────────────────────────────────

    async def get_analytics_dashboard(self) -> Any:
        return await self._get("/api/v1/analytics/dashboard")

    async def get_analytics_summary(self) -> Any:
        return await self._get("/api/v1/analytics/summary")

    # ── Models ───────────────────────────────────────────────────

    async def list_models(self) -> Any:
        return await self._get("/api/v1/models")

    # ── API Keys ─────────────────────────────────────────────────

    async def list_api_keys(self) -> Any:
        return await self._get("/api/v1/keys")

    async def create_api_key(self, name: str, tier: str = "free") -> Any:
        return await self._post("/api/v1/keys/create", {"name": name, "tier": tier})

    # ── Billing ──────────────────────────────────────────────────

    async def get_billing_usage(self) -> Any:
        return await self._get("/api/v1/billing/usage")
