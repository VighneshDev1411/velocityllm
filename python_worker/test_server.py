"""
VelocityLLM Python Worker - Simple Test Server
Tests gRPC without vLLM
"""

import asyncio
import grpc
from concurrent import futures
import time
import sys
from loguru import logger

# Import generated protobuf
import inference_pb2
import inference_pb2_grpc


class TestInferenceService(inference_pb2_grpc.InferenceServiceServicer):
    """Test inference service"""

    def __init__(self):
        self.request_count = 0
        self.start_time = time.time()
        logger.info("✅ Test Inference Service initialized")

    async def Inference(self, request, context):
        """Synchronous inference"""
        self.request_count += 1

        logger.info(f"📨 [Request {self.request_count}] Inference request")
        logger.info(f"   Model: {request.model_name}")
        logger.info(f"   Prompt: {request.prompt[:80]}...")

        # Simulate processing
        await asyncio.sleep(0.3)

        # Generate mock response
        output = f"Mock response to: '{request.prompt[:50]}...' from {request.model_name}"

        response = inference_pb2.InferenceResponse(
            request_id=request.request_id,
            model_name=request.model_name,
            output=output,
            tokens_generated=len(output.split()),
            tokens_prompt=len(request.prompt.split()),
            inference_time_ms=300,
            queue_time_ms=10,
            success=True,
            error=""
        )

        logger.success(f"✅ [Request {self.request_count}] Response sent: {response.tokens_generated} tokens")
        return response

    async def StreamInference(self, request, context):
        """Streaming inference"""
        self.request_count += 1

        logger.info(f"🌊 [Stream {self.request_count}] Streaming request")
        logger.info(f"   Model: {request.model_name}")
        logger.info(f"   Prompt: {request.prompt[:80]}...")

        # Mock tokens
        tokens = ["This", " is", " a", " test", " response", " from", " the", " Python", " worker", "!"]

        for i, token in enumerate(tokens):
            await asyncio.sleep(0.1)

            chunk = inference_pb2.InferenceStreamResponse(
                request_id=request.request_id,
                chunk_index=i,
                token=token,
                is_final=(i == len(tokens) - 1)
            )

            if chunk.is_final:
                chunk.total_tokens = len(tokens)
                chunk.total_time_ms = 1000

            yield chunk

        logger.success(f"✅ [Stream {self.request_count}] Stream completed")

    async def LoadModel(self, request, context):
        """Load model (mock)"""
        logger.info(f"📥 Loading model: {request.model_name}")
        await asyncio.sleep(0.5)

        return inference_pb2.LoadModelResponse(
            success=True,
            message=f"Model {request.model_name} loaded successfully (mock)",
            model_name=request.model_name,
            load_time_ms=500
        )

    async def UnloadModel(self, request, context):
        """Unload model (mock)"""
        logger.info(f"📤 Unloading model: {request.model_name}")

        return inference_pb2.UnloadModelResponse(
            success=True,
            message=f"Model {request.model_name} unloaded (mock)"
        )

    async def GetModelInfo(self, request, context):
        """Get model info (mock)"""
        logger.info(f"ℹ️  Getting info for: {request.model_name}")

        return inference_pb2.GetModelInfoResponse(
            model_name=request.model_name,
            loaded=True,
            device="cpu",
            model_size_mb=1024,
            max_tokens=4096,
            quantization="fp32"
        )

    async def HealthCheck(self, request, context):
        """Health check"""
        uptime = int(time.time() - self.start_time)

        return inference_pb2.HealthCheckResponse(
            status="healthy",
            message="Test worker is running",
            uptime_seconds=uptime,
            models_loaded=["test-model"],
            gpu_available=False,
            total_requests=self.request_count
        )


async def serve():
    """Start gRPC server"""
    server = grpc.aio.server(futures.ThreadPoolExecutor(max_workers=10))

    # Add service
    service = TestInferenceService()
    inference_pb2_grpc.add_InferenceServiceServicer_to_server(service, server)

    # Listen
    port = "50051"
    server.add_insecure_port(f"[::]:{port}")

    logger.info("")
    logger.info("=" * 70)
    logger.info("🚀 VelocityLLM Python Worker - TEST MODE")
    logger.info("=" * 70)
    logger.info(f"📡 gRPC Server listening on port {port}")
    logger.info("🔗 Ready to receive requests from Go backend (localhost:8080)")
    logger.info("⚠️  This is a MOCK worker for testing (no vLLM)")
    logger.info("=" * 70)
    logger.info("")

    await server.start()
    logger.success(f"✅ Server started successfully!")
    logger.info("💡 Test with: grpcurl -plaintext localhost:50051 list")
    logger.info("🛑 Press Ctrl+C to stop")
    logger.info("")

    try:
        await server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("\n🛑 Shutting down...")
        await server.stop(5)
        logger.info("✅ Server stopped")


if __name__ == "__main__":
    # Configure logger
    logger.remove()
    logger.add(
        sys.stderr,
        format="<green>{time:HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <level>{message}</level>",
        level="INFO",
        colorize=True
    )

    # Run
    try:
        asyncio.run(serve())
    except Exception as e:
        logger.error(f"❌ Failed to start: {e}")
        sys.exit(1)
