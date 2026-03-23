"""Configuration for VelocityLLM MCP Server."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    """MCP Server configuration loaded from environment variables."""

    api_url: str
    api_key: str

    @classmethod
    def from_env(cls) -> "Config":
        api_url = os.getenv("VELOCITYLLM_API_URL", "http://localhost:8080")
        api_key = os.getenv("VELOCITYLLM_API_KEY", "")
        return cls(api_url=api_url.rstrip("/"), api_key=api_key)
