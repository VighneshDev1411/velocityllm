"""
VelocityLLM Python Worker Configuration
Day 8: Worker settings and model configurations
"""

import os
from typing import Optional
from pydantic import BaseModel, Field


class ServerConfig(BaseModel):
    """gRPC Server configuration"""
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=50051, description="Server port")
    max_workers: int = Field(default=10, description="Max gRPC worker threads")
    max_concurrent_rpcs: int = Field(default=100, description="Max concurrent RPCs")
    
    # Keepalive settings
    keepalive_time_ms: int = Field(default=30000, description="Keepalive time in ms")
    keepalive_timeout_ms: int = Field(default=10000, description="Keepalive timeout in ms")
    keepalive_permit_without_calls: bool = Field(default=True)
    
    # Message size limits
    max_send_message_length: int = Field(default=100 * 1024 * 1024, description="100 MB")
    max_receive_message_length: int = Field(default=100 * 1024 * 1024, description="100 MB")


class ModelConfig(BaseModel):
    """Model configuration for vLLM"""
    model_name: str = Field(description="Model identifier")
    model_path: str = Field(description="Path to model weights")
    
    # Device settings
    device: str = Field(default="auto", description="Device: cuda, cpu, auto")
    tensor_parallel_size: int = Field(default=1, description="Tensor parallelism size")
    
    # Memory settings
    gpu_memory_utilization: float = Field(default=0.9, description="GPU memory fraction")
    max_model_len: Optional[int] = Field(default=None, description="Max sequence length")
    
    # Quantization
    quantization: Optional[str] = Field(default=None, description="awq, gptq, squeezellm")
    dtype: str = Field(default="auto", description="Data type: auto, float16, bfloat16")
    
    # Performance
    enable_prefix_caching: bool = Field(default=True, description="Enable prefix caching")
    enforce_eager: bool = Field(default=False, description="Disable CUDA graphs")
    max_num_seqs: int = Field(default=256, description="Max number of sequences")
    max_num_batched_tokens: Optional[int] = Field(default=None, description="Max batched tokens")
    
    # Trust settings
    trust_remote_code: bool = Field(default=False, description="Trust remote code")


class WorkerConfig(BaseModel):
    """Worker configuration"""
    worker_id: str = Field(default="worker-python-1", description="Worker identifier")
    
    # Health check settings
    health_check_interval: int = Field(default=10, description="Health check interval (seconds)")
    heartbeat_interval: int = Field(default=5, description="Heartbeat interval (seconds)")
    
    # Resource limits
    max_queue_size: int = Field(default=1000, description="Max request queue size")
    request_timeout: int = Field(default=300, description="Request timeout (seconds)")
    
    # Logging
    log_level: str = Field(default="INFO", description="Log level")
    log_file: Optional[str] = Field(default=None, description="Log file path")
    
    # Metrics
    enable_metrics: bool = Field(default=True, description="Enable metrics collection")
    metrics_port: int = Field(default=9090, description="Metrics server port")


class InferenceConfig(BaseModel):
    """Inference configuration"""
    # Generation defaults
    default_max_tokens: int = Field(default=512, description="Default max tokens")
    default_temperature: float = Field(default=0.7, description="Default temperature")
    default_top_p: float = Field(default=0.95, description="Default top_p")
    default_top_k: int = Field(default=50, description="Default top_k")
    
    # Streaming
    stream_chunk_size: int = Field(default=1, description="Tokens per stream chunk")
    
    # Safety limits
    max_tokens_limit: int = Field(default=4096, description="Maximum allowed tokens")
    min_temperature: float = Field(default=0.0, description="Minimum temperature")
    max_temperature: float = Field(default=2.0, description="Maximum temperature")


class Config:
    """Main configuration container"""
    
    def __init__(self):
        self.server = ServerConfig()
        self.worker = WorkerConfig()
        self.inference = InferenceConfig()
        self.models = {}
        
        # Load from environment
        self._load_from_env()
    
    def _load_from_env(self):
        """Load configuration from environment variables"""
        # Server config
        self.server.host = os.getenv("GRPC_HOST", self.server.host)
        self.server.port = int(os.getenv("GRPC_PORT", self.server.port))
        
        # Worker config
        self.worker.worker_id = os.getenv("WORKER_ID", self.worker.worker_id)
        self.worker.log_level = os.getenv("LOG_LEVEL", self.worker.log_level)
        
        # Device config
        device = os.getenv("DEVICE", "auto")
        
        # Add default models
        self._add_default_models(device)
    
    def _add_default_models(self, device: str):
        """Add default model configurations"""
        # GPT-2 (small, for testing)
        self.models["gpt2"] = ModelConfig(
            model_name="gpt2",
            model_path="gpt2",
            device=device,
            max_model_len=1024,
            gpu_memory_utilization=0.3,
        )
        
        # Llama-2-7B (if available)
        self.models["llama-2-7b"] = ModelConfig(
            model_name="llama-2-7b",
            model_path="meta-llama/Llama-2-7b-hf",
            device=device,
            max_model_len=4096,
            gpu_memory_utilization=0.9,
            enable_prefix_caching=True,
        )
        
        # Mistral-7B (if available)
        self.models["mistral-7b"] = ModelConfig(
            model_name="mistral-7b",
            model_path="mistralai/Mistral-7B-v0.1",
            device=device,
            max_model_len=8192,
            gpu_memory_utilization=0.9,
            enable_prefix_caching=True,
        )
        
        # GPT-3.5 placeholder (maps to smaller model for testing)
        self.models["gpt-3.5-turbo"] = ModelConfig(
            model_name="gpt-3.5-turbo",
            model_path="gpt2",  # Use GPT-2 as placeholder
            device=device,
            max_model_len=2048,
            gpu_memory_utilization=0.5,
        )
        
        # GPT-4 placeholder
        self.models["gpt-4"] = ModelConfig(
            model_name="gpt-4",
            model_path="gpt2",  # Use GPT-2 as placeholder
            device=device,
            max_model_len=4096,
            gpu_memory_utilization=0.7,
        )
    
    def get_model_config(self, model_name: str) -> Optional[ModelConfig]:
        """Get configuration for a specific model"""
        return self.models.get(model_name)
    
    def add_model_config(self, config: ModelConfig):
        """Add a new model configuration"""
        self.models[config.model_name] = config
    
    def to_dict(self) -> dict:
        """Convert config to dictionary"""
        return {
            "server": self.server.model_dump(),
            "worker": self.worker.model_dump(),
            "inference": self.inference.model_dump(),
            "models": {
                name: config.model_dump() 
                for name, config in self.models.items()
            }
        }


# Global configuration instance
config = Config()


def get_config() -> Config:
    """Get global configuration instance"""
    return config


if __name__ == "__main__":
    # Print configuration
    import json
    cfg = get_config()
    print(json.dumps(cfg.to_dict(), indent=2))