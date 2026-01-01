"""
VelocityLLM vLLM Inference Engine
Day 8: High-performance LLM inference with vLLM
"""

import asyncio
import time
from typing import AsyncIterator, Dict, List, Optional, Any
from dataclasses import dataclass

from vllm import LLM, SamplingParams
from vllm.outputs import RequestOutput
from loguru import logger

from config import ModelConfig, InferenceConfig


@dataclass
class InferenceRequest:
    """Request for inference"""
    request_id: str
    prompt: str
    max_tokens: int = 512
    temperature: float = 0.7
    top_p: float = 0.95
    top_k: int = 50
    stop_sequences: Optional[List[str]] = None
    stream: bool = False


@dataclass
class InferenceResult:
    """Result from inference"""
    request_id: str
    output: str
    tokens_generated: int
    tokens_prompt: int
    inference_time_ms: int
    success: bool
    error: Optional[str] = None


class VLLMEngine:
    """vLLM-based inference engine"""
    
    def __init__(self, model_config: ModelConfig, inference_config: InferenceConfig):
        self.model_config = model_config
        self.inference_config = inference_config
        self.llm: Optional[LLM] = None
        self.is_loaded = False
        
        # Statistics
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0
        self.total_tokens_generated = 0
        self.total_inference_time_ms = 0
        
        logger.info(f"Initializing vLLM engine for model: {model_config.model_name}")
    
    def load_model(self) -> Dict[str, Any]:
        """Load the model into memory"""
        if self.is_loaded:
            logger.warning(f"Model {self.model_config.model_name} is already loaded")
            return {
                "success": True,
                "message": "Model already loaded",
                "model_name": self.model_config.model_name
            }
        
        try:
            start_time = time.time()
            logger.info(f"Loading model: {self.model_config.model_path}")
            
            # Initialize vLLM engine
            self.llm = LLM(
                model=self.model_config.model_path,
                tensor_parallel_size=self.model_config.tensor_parallel_size,
                gpu_memory_utilization=self.model_config.gpu_memory_utilization,
                max_model_len=self.model_config.max_model_len,
                dtype=self.model_config.dtype,
                quantization=self.model_config.quantization,
                enforce_eager=self.model_config.enforce_eager,
                max_num_seqs=self.model_config.max_num_seqs,
                max_num_batched_tokens=self.model_config.max_num_batched_tokens,
                trust_remote_code=self.model_config.trust_remote_code,
            )
            
            load_time_ms = int((time.time() - start_time) * 1000)
            self.is_loaded = True
            
            logger.info(
                f"Model loaded successfully: {self.model_config.model_name} "
                f"in {load_time_ms}ms"
            )
            
            return {
                "success": True,
                "model_name": self.model_config.model_name,
                "load_time_ms": load_time_ms,
                "device": self.model_config.device,
            }
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            self.is_loaded = False
            return {
                "success": False,
                "error": str(e),
                "model_name": self.model_config.model_name,
            }
    
    def unload_model(self) -> Dict[str, Any]:
        """Unload the model from memory"""
        if not self.is_loaded:
            return {
                "success": True,
                "message": "Model not loaded",
            }
        
        try:
            start_time = time.time()
            logger.info(f"Unloading model: {self.model_config.model_name}")
            
            # Clear vLLM engine
            del self.llm
            self.llm = None
            self.is_loaded = False
            
            # Force garbage collection
            import gc
            gc.collect()
            
            # Clear CUDA cache if using GPU
            if self.model_config.device in ["cuda", "auto"]:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            
            unload_time_ms = int((time.time() - start_time) * 1000)
            
            logger.info(f"Model unloaded: {self.model_config.model_name}")
            
            return {
                "success": True,
                "model_name": self.model_config.model_name,
                "unload_time_ms": unload_time_ms,
            }
            
        except Exception as e:
            logger.error(f"Failed to unload model: {e}")
            return {
                "success": False,
                "error": str(e),
            }
    
    def inference(self, request: InferenceRequest) -> InferenceResult:
        """Perform synchronous inference"""
        if not self.is_loaded:
            return InferenceResult(
                request_id=request.request_id,
                output="",
                tokens_generated=0,
                tokens_prompt=0,
                inference_time_ms=0,
                success=False,
                error="Model not loaded",
            )
        
        try:
            start_time = time.time()
            self.total_requests += 1
            
            # Create sampling parameters
            sampling_params = SamplingParams(
                max_tokens=min(request.max_tokens, self.inference_config.max_tokens_limit),
                temperature=max(
                    self.inference_config.min_temperature,
                    min(request.temperature, self.inference_config.max_temperature)
                ),
                top_p=request.top_p,
                top_k=request.top_k,
                stop=request.stop_sequences,
            )
            
            # Generate
            outputs = self.llm.generate([request.prompt], sampling_params)
            output = outputs[0]
            
            # Extract results
            generated_text = output.outputs[0].text
            tokens_generated = len(output.outputs[0].token_ids)
            tokens_prompt = len(output.prompt_token_ids)
            
            inference_time_ms = int((time.time() - start_time) * 1000)
            
            # Update statistics
            self.successful_requests += 1
            self.total_tokens_generated += tokens_generated
            self.total_inference_time_ms += inference_time_ms
            
            logger.debug(
                f"Inference completed: {request.request_id} "
                f"({tokens_generated} tokens in {inference_time_ms}ms)"
            )
            
            return InferenceResult(
                request_id=request.request_id,
                output=generated_text,
                tokens_generated=tokens_generated,
                tokens_prompt=tokens_prompt,
                inference_time_ms=inference_time_ms,
                success=True,
            )
            
        except Exception as e:
            logger.error(f"Inference failed for {request.request_id}: {e}")
            self.failed_requests += 1
            
            return InferenceResult(
                request_id=request.request_id,
                output="",
                tokens_generated=0,
                tokens_prompt=0,
                inference_time_ms=0,
                success=False,
                error=str(e),
            )
    
    async def stream_inference(
        self, 
        request: InferenceRequest
    ) -> AsyncIterator[Dict[str, Any]]:
        """Perform streaming inference"""
        if not self.is_loaded:
            yield {
                "request_id": request.request_id,
                "error": "Model not loaded",
                "is_final": True,
            }
            return
        
        try:
            start_time = time.time()
            self.total_requests += 1
            
            # Create sampling parameters
            sampling_params = SamplingParams(
                max_tokens=min(request.max_tokens, self.inference_config.max_tokens_limit),
                temperature=max(
                    self.inference_config.min_temperature,
                    min(request.temperature, self.inference_config.max_temperature)
                ),
                top_p=request.top_p,
                top_k=request.top_k,
                stop=request.stop_sequences,
            )
            
            # For vLLM, we'll use generate and simulate streaming
            # Note: vLLM's async API can be used for true streaming in production
            outputs = await asyncio.to_thread(
                self.llm.generate,
                [request.prompt],
                sampling_params
            )
            
            output = outputs[0]
            generated_text = output.outputs[0].text
            token_ids = output.outputs[0].token_ids
            
            # Simulate streaming by yielding tokens in chunks
            chunk_size = self.inference_config.stream_chunk_size
            
            for i in range(0, len(token_ids), chunk_size):
                # Get token chunk
                chunk_token_ids = token_ids[i:i + chunk_size]
                
                # Decode chunk (simplified - in production use tokenizer)
                # For now, split the text proportionally
                chunk_start = int((i / len(token_ids)) * len(generated_text))
                chunk_end = int(((i + chunk_size) / len(token_ids)) * len(generated_text))
                chunk_text = generated_text[chunk_start:chunk_end]
                
                is_final = (i + chunk_size) >= len(token_ids)
                
                yield {
                    "request_id": request.request_id,
                    "chunk_index": i // chunk_size,
                    "token": chunk_text,
                    "is_final": is_final,
                    "total_tokens": len(token_ids) if is_final else 0,
                    "total_time_ms": int((time.time() - start_time) * 1000) if is_final else 0,
                }
                
                # Small delay to simulate streaming
                if not is_final:
                    await asyncio.sleep(0.01)
            
            # Update statistics
            self.successful_requests += 1
            self.total_tokens_generated += len(token_ids)
            self.total_inference_time_ms += int((time.time() - start_time) * 1000)
            
        except Exception as e:
            logger.error(f"Streaming inference failed for {request.request_id}: {e}")
            self.failed_requests += 1
            
            yield {
                "request_id": request.request_id,
                "error": str(e),
                "is_final": True,
            }
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get engine statistics"""
        avg_inference_time = 0
        if self.successful_requests > 0:
            avg_inference_time = self.total_inference_time_ms / self.successful_requests
        
        return {
            "model_name": self.model_config.model_name,
            "is_loaded": self.is_loaded,
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "total_tokens_generated": self.total_tokens_generated,
            "avg_inference_time_ms": avg_inference_time,
        }
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            "model_name": self.model_config.model_name,
            "model_path": self.model_config.model_path,
            "is_loaded": self.is_loaded,
            "device": self.model_config.device,
            "max_model_len": self.model_config.max_model_len,
            "gpu_memory_utilization": self.model_config.gpu_memory_utilization,
            "tensor_parallel_size": self.model_config.tensor_parallel_size,
        }


class ModelManager:
    """Manages multiple vLLM engines"""
    
    def __init__(self, inference_config: InferenceConfig):
        self.inference_config = inference_config
        self.engines: Dict[str, VLLMEngine] = {}
        logger.info("Model manager initialized")
    
    def add_model(self, model_config: ModelConfig) -> VLLMEngine:
        """Add a new model"""
        if model_config.model_name in self.engines:
            logger.warning(f"Model {model_config.model_name} already exists")
            return self.engines[model_config.model_name]
        
        engine = VLLMEngine(model_config, self.inference_config)
        self.engines[model_config.model_name] = engine
        
        logger.info(f"Added model: {model_config.model_name}")
        return engine
    
    def get_engine(self, model_name: str) -> Optional[VLLMEngine]:
        """Get engine for a model"""
        return self.engines.get(model_name)
    
    def load_model(self, model_name: str) -> Dict[str, Any]:
        """Load a model"""
        engine = self.get_engine(model_name)
        if not engine:
            return {
                "success": False,
                "error": f"Model {model_name} not found",
            }
        
        return engine.load_model()
    
    def unload_model(self, model_name: str) -> Dict[str, Any]:
        """Unload a model"""
        engine = self.get_engine(model_name)
        if not engine:
            return {
                "success": False,
                "error": f"Model {model_name} not found",
            }
        
        return engine.unload_model()
    
    def get_loaded_models(self) -> List[str]:
        """Get list of loaded models"""
        return [
            name for name, engine in self.engines.items()
            if engine.is_loaded
        ]
    
    def get_all_statistics(self) -> Dict[str, Any]:
        """Get statistics for all models"""
        return {
            name: engine.get_statistics()
            for name, engine in self.engines.items()
        }