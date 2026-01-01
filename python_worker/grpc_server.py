"""
VelocityLLM Python gRPC Server
Day 8: gRPC server for LLM inference
"""

import asyncio
import time
from concurrent import futures
from typing import Iterator

import grpc
from loguru import logger

# Import generated protobuf code (will be generated from .proto file)
# For now, we'll create the implementation structure
# In production: python -m grpc_tools.protoc -I../proto --python_out=. --grpc_python_out=. ../proto/inference.proto

from config import get_config
from inference_engine import ModelManager, InferenceRequest
from health_monitor import HealthMonitor


# Placeholder for generated protobuf imports
# These will be generated when you compile the .proto file
try:
    from proto import inference_pb2, inference_pb2_grpc
except ImportError:
    logger.warning("Protobuf files not generated yet. Run: python -m grpc_tools.protoc")
    # Create dummy classes for development
    class inference_pb2:
        class InferenceRequest:
            pass
        class InferenceResponse:
            pass
        class InferenceStreamResponse:
            pass
        class LoadModelRequest:
            pass
        class LoadModelResponse:
            pass
        class UnloadModelRequest:
            pass
        class UnloadModelResponse:
            pass
        class GetModelInfoRequest:
            pass
        class GetModelInfoResponse:
            pass
        class HealthCheckRequest:
            pass
        class HealthCheckResponse:
            pass
    
    class inference_pb2_grpc:
        class InferenceServiceServicer:
            pass
        @staticmethod
        def add_InferenceServiceServicer_to_server(servicer, server):
            pass


class InferenceServicer(inference_pb2_grpc.InferenceServiceServicer):
    """Implementation of InferenceService gRPC service"""
    
    def __init__(self, model_manager: ModelManager, health_monitor: HealthMonitor):
        self.model_manager = model_manager
        self.health_monitor = health_monitor
        self.config = get_config()
        
        # Statistics
        self.total_requests = 0
        self.active_requests = 0
        self.start_time = time.time()
        
        logger.info("InferenceServicer initialized")
    
    async def Inference(self, request, context):
        """Synchronous inference"""
        self.total_requests += 1
        self.active_requests += 1
        
        start_time = time.time()
        queue_time_ms = 0  # In production, track actual queue time
        
        try:
            logger.info(f"Inference request: {request.request_id} for model {request.model_name}")
            
            # Get engine for the model
            engine = self.model_manager.get_engine(request.model_name)
            if not engine:
                logger.error(f"Model not found: {request.model_name}")
                return self._create_error_response(
                    request.request_id,
                    request.model_name,
                    f"Model {request.model_name} not found"
                )
            
            if not engine.is_loaded:
                logger.warning(f"Model not loaded: {request.model_name}, loading now...")
                load_result = engine.load_model()
                if not load_result["success"]:
                    return self._create_error_response(
                        request.request_id,
                        request.model_name,
                        f"Failed to load model: {load_result.get('error')}"
                    )
            
            # Create inference request
            inf_request = InferenceRequest(
                request_id=request.request_id,
                prompt=request.prompt,
                max_tokens=request.max_tokens or self.config.inference.default_max_tokens,
                temperature=request.temperature or self.config.inference.default_temperature,
                top_p=request.top_p or self.config.inference.default_top_p,
                top_k=int(request.top_k) if request.top_k else self.config.inference.default_top_k,
                stop_sequences=list(request.stop_sequences) if request.stop_sequences else None,
                stream=False,
            )
            
            # Perform inference
            result = await asyncio.to_thread(engine.inference, inf_request)
            
            inference_time_ms = int((time.time() - start_time) * 1000)
            
            # Update health monitor
            self.health_monitor.record_request(success=result.success)
            
            # Create response
            response = inference_pb2.InferenceResponse(
                request_id=result.request_id,
                model_name=request.model_name,
                output=result.output,
                tokens_generated=result.tokens_generated,
                tokens_prompt=result.tokens_prompt,
                inference_time_ms=result.inference_time_ms,
                queue_time_ms=queue_time_ms,
                success=result.success,
                error=result.error or "",
            )
            
            logger.info(
                f"Inference completed: {request.request_id} "
                f"({result.tokens_generated} tokens in {inference_time_ms}ms)"
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Inference error: {e}")
            self.health_monitor.record_request(success=False)
            return self._create_error_response(
                request.request_id,
                request.model_name,
                str(e)
            )
        finally:
            self.active_requests -= 1
    
    async def StreamInference(self, request, context):
        """Streaming inference"""
        self.total_requests += 1
        self.active_requests += 1
        
        try:
            logger.info(f"Stream inference request: {request.request_id} for model {request.model_name}")
            
            # Get engine for the model
            engine = self.model_manager.get_engine(request.model_name)
            if not engine:
                yield self._create_stream_error(
                    request.request_id,
                    f"Model {request.model_name} not found"
                )
                return
            
            if not engine.is_loaded:
                logger.warning(f"Model not loaded: {request.model_name}, loading now...")
                load_result = engine.load_model()
                if not load_result["success"]:
                    yield self._create_stream_error(
                        request.request_id,
                        f"Failed to load model: {load_result.get('error')}"
                    )
                    return
            
            # Create inference request
            inf_request = InferenceRequest(
                request_id=request.request_id,
                prompt=request.prompt,
                max_tokens=request.max_tokens or self.config.inference.default_max_tokens,
                temperature=request.temperature or self.config.inference.default_temperature,
                top_p=request.top_p or self.config.inference.default_top_p,
                top_k=int(request.top_k) if request.top_k else self.config.inference.default_top_k,
                stop_sequences=list(request.stop_sequences) if request.stop_sequences else None,
                stream=True,
            )
            
            # Stream inference
            chunk_count = 0
            async for chunk in engine.stream_inference(inf_request):
                chunk_count += 1
                
                response = inference_pb2.InferenceStreamResponse(
                    request_id=chunk["request_id"],
                    chunk_index=chunk.get("chunk_index", chunk_count),
                    token=chunk.get("token", ""),
                    is_final=chunk.get("is_final", False),
                    total_tokens=chunk.get("total_tokens", 0),
                    total_time_ms=chunk.get("total_time_ms", 0),
                )
                
                yield response
                
                if chunk.get("is_final"):
                    self.health_monitor.record_request(success=True)
                    logger.info(f"Stream completed: {request.request_id} ({chunk_count} chunks)")
                    break
            
        except Exception as e:
            logger.error(f"Stream inference error: {e}")
            self.health_monitor.record_request(success=False)
            yield self._create_stream_error(request.request_id, str(e))
        finally:
            self.active_requests -= 1
    
    async def LoadModel(self, request, context):
        """Load a model into memory"""
        logger.info(f"Load model request: {request.model_name}")
        
        try:
            # Get or create engine
            engine = self.model_manager.get_engine(request.model_name)
            
            if not engine:
                # Create new model config from request
                from config import ModelConfig
                
                model_config = ModelConfig(
                    model_name=request.model_name,
                    model_path=request.model_path,
                    device=request.device or "auto",
                    tensor_parallel_size=request.tensor_parallel_size or 1,
                    gpu_memory_utilization=request.gpu_memory_mb / 1000.0 if request.gpu_memory_mb else 0.9,
                    quantization=request.quantization if request.quantization else None,
                    max_model_len=request.max_model_len if request.max_model_len else None,
                    enable_prefix_caching=request.enable_prefix_caching,
                )
                
                engine = self.model_manager.add_model(model_config)
            
            # Load the model
            result = engine.load_model()
            
            response = inference_pb2.LoadModelResponse(
                success=result["success"],
                error=result.get("error", ""),
                model_name=request.model_name,
                model_size_mb=0,  # TODO: Calculate actual model size
                load_time_ms=result.get("load_time_ms", 0),
                device=result.get("device", ""),
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Load model error: {e}")
            return inference_pb2.LoadModelResponse(
                success=False,
                error=str(e),
                model_name=request.model_name,
            )
    
    async def UnloadModel(self, request, context):
        """Unload a model from memory"""
        logger.info(f"Unload model request: {request.model_name}")
        
        try:
            result = self.model_manager.unload_model(request.model_name)
            
            response = inference_pb2.UnloadModelResponse(
                success=result["success"],
                error=result.get("error", ""),
                model_name=request.model_name,
                unload_time_ms=result.get("unload_time_ms", 0),
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Unload model error: {e}")
            return inference_pb2.UnloadModelResponse(
                success=False,
                error=str(e),
                model_name=request.model_name,
            )
    
    async def GetModelInfo(self, request, context):
        """Get information about a model"""
        logger.debug(f"Get model info request: {request.model_name}")
        
        try:
            engine = self.model_manager.get_engine(request.model_name)
            
            if not engine:
                return inference_pb2.GetModelInfoResponse(
                    success=False,
                    error=f"Model {request.model_name} not found",
                )
            
            info = engine.get_model_info()
            stats = engine.get_statistics()
            
            response = inference_pb2.GetModelInfoResponse(
                success=True,
                model_name=info["model_name"],
                model_path=info["model_path"],
                is_loaded=info["is_loaded"],
                memory_usage_mb=0,  # TODO: Get actual memory usage
                device=info["device"],
                max_context_length=info.get("max_model_len", 0),
                total_requests=stats["total_requests"],
                total_tokens_generated=stats["total_tokens_generated"],
                avg_inference_time_ms=stats["avg_inference_time_ms"],
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Get model info error: {e}")
            return inference_pb2.GetModelInfoResponse(
                success=False,
                error=str(e),
            )
    
    async def HealthCheck(self, request, context):
        """Perform health check"""
        logger.debug("Health check request")
        
        try:
            health_status = self.health_monitor.get_health_status()
            
            response = inference_pb2.HealthCheckResponse(
                status=health_status["status"],
                cpu_usage_percent=health_status["cpu_percent"],
                memory_usage_percent=health_status["memory_percent"],
                gpu_usage_percent=health_status.get("gpu_percent", 0),
                gpu_memory_usage_percent=health_status.get("gpu_memory_percent", 0),
                active_requests=self.active_requests,
                queued_requests=0,  # TODO: Track queue size
                loaded_models=len(self.model_manager.get_loaded_models()),
                uptime_seconds=int(time.time() - self.start_time),
                last_request_time_ms=0,  # TODO: Track last request time
            )
            
            return response
            
        except Exception as e:
            logger.error(f"Health check error: {e}")
            return inference_pb2.HealthCheckResponse(
                status="unhealthy",
                error=str(e),
            )
    
    def _create_error_response(self, request_id: str, model_name: str, error: str):
        """Create error response"""
        return inference_pb2.InferenceResponse(
            request_id=request_id,
            model_name=model_name,
            output="",
            tokens_generated=0,
            tokens_prompt=0,
            inference_time_ms=0,
            queue_time_ms=0,
            success=False,
            error=error,
        )
    
    def _create_stream_error(self, request_id: str, error: str):
        """Create stream error response"""
        return inference_pb2.InferenceStreamResponse(
            request_id=request_id,
            chunk_index=0,
            token="",
            is_final=True,
            metadata={"error": error},
        )


async def serve(
    model_manager: ModelManager,
    health_monitor: HealthMonitor,
):
    """Start gRPC server"""
    config = get_config()
    
    # Create server
    server = grpc.aio.server(
        futures.ThreadPoolExecutor(max_workers=config.server.max_workers),
        options=[
            ('grpc.max_send_message_length', config.server.max_send_message_length),
            ('grpc.max_receive_message_length', config.server.max_receive_message_length),
            ('grpc.keepalive_time_ms', config.server.keepalive_time_ms),
            ('grpc.keepalive_timeout_ms', config.server.keepalive_timeout_ms),
            ('grpc.keepalive_permit_without_calls', config.server.keepalive_permit_without_calls),
            ('grpc.http2.max_pings_without_data', 0),
            ('grpc.http2.min_time_between_pings_ms', 10000),
            ('grpc.http2.min_ping_interval_without_data_ms', 5000),
        ]
    )
    
    # Add servicer
    servicer = InferenceServicer(model_manager, health_monitor)
    inference_pb2_grpc.add_InferenceServiceServicer_to_server(servicer, server)
    
    # Bind to port
    address = f"{config.server.host}:{config.server.port}"
    server.add_insecure_port(address)
    
    # Start server
    logger.info(f"Starting gRPC server on {address}")
    await server.start()
    
    logger.info(f"✅ gRPC server started successfully on {address}")
    logger.info(f"Worker ID: {config.worker.worker_id}")
    logger.info(f"Ready to accept inference requests")
    
    # Wait for termination
    await server.wait_for_termination()


if __name__ == "__main__":
    # This file is imported by main.py
    pass