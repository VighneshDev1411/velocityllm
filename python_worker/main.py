"""
VelocityLLM Python Worker - Main Entry Point
Day 8: Python gRPC worker with vLLM
"""

import asyncio
import signal
import sys
from loguru import logger

from config import get_config
from inference_engine import ModelManager
from health_monitor import HealthMonitor
from grpc_server import serve


class WorkerService:
    """Main worker service orchestrator"""
    
    def __init__(self):
        self.config = get_config()
        self.running = False
        
        # Initialize components
        logger.info("Initializing VelocityLLM Python Worker")
        
        # Setup logger
        self._setup_logger()
        
        # Create components
        self.health_monitor = HealthMonitor()
        self.model_manager = ModelManager(self.config.inference)
        
        # Pre-load models if configured
        self._preload_models()
        
        logger.info(f"Worker initialized: {self.config.worker.worker_id}")
    
    def _setup_logger(self):
        """Configure logger"""
        logger.remove()  # Remove default handler
        
        # Console handler
        logger.add(
            sys.stderr,
            format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
            level=self.config.worker.log_level,
            colorize=True,
        )
        
        # File handler (if configured)
        if self.config.worker.log_file:
            logger.add(
                self.config.worker.log_file,
                rotation="100 MB",
                retention="7 days",
                level=self.config.worker.log_level,
                format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function} - {message}",
            )
        
        logger.info("Logger configured")
    
    def _preload_models(self):
        """Pre-load configured models"""
        # Add all configured models to manager
        for model_name, model_config in self.config.models.items():
            self.model_manager.add_model(model_config)
            logger.info(f"Model registered: {model_name}")
        
        # Auto-load default model (GPT-2 for testing)
        default_model = "gpt2"
        if default_model in self.config.models:
            logger.info(f"Pre-loading default model: {default_model}")
            try:
                result = self.model_manager.load_model(default_model)
                if result["success"]:
                    logger.info(f"Default model loaded: {default_model}")
                else:
                    logger.warning(f"Failed to load default model: {result.get('error')}")
            except Exception as e:
                logger.warning(f"Error pre-loading default model: {e}")
    
    async def start(self):
        """Start the worker service"""
        self.running = True
        
        logger.info("=" * 70)
        logger.info("🚀 VelocityLLM Python Worker Starting")
        logger.info("=" * 70)
        logger.info(f"Worker ID: {self.config.worker.worker_id}")
        logger.info(f"gRPC Server: {self.config.server.host}:{self.config.server.port}")
        logger.info(f"Max Workers: {self.config.server.max_workers}")
        logger.info(f"GPU Available: {self.health_monitor.gpu_available}")
        logger.info(f"Loaded Models: {len(self.model_manager.get_loaded_models())}")
        logger.info("=" * 70)
        
        # Start health monitoring
        health_task = asyncio.create_task(self._health_monitoring_loop())
        
        # Start gRPC server
        try:
            await serve(self.model_manager, self.health_monitor)
        except Exception as e:
            logger.error(f"Server error: {e}")
            raise
        finally:
            self.running = False
            health_task.cancel()
    
    async def _health_monitoring_loop(self):
        """Background health monitoring"""
        interval = self.config.worker.health_check_interval
        
        while self.running:
            try:
                await asyncio.sleep(interval)
                
                # Log health status
                status = self.health_monitor.get_health_status()
                
                if status["status"] != "healthy":
                    logger.warning(
                        f"Health Status: {status['status']} | "
                        f"CPU: {status['cpu_percent']:.1f}% | "
                        f"Memory: {status['memory_percent']:.1f}% | "
                        f"Requests: {status['total_requests']} "
                        f"(Success Rate: {status['success_rate']:.1f}%)"
                    )
                else:
                    logger.debug(
                        f"Health: {status['status']} | "
                        f"{self.health_monitor.get_resource_usage_summary()}"
                    )
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health monitoring error: {e}")
    
    async def shutdown(self):
        """Graceful shutdown"""
        logger.info("Shutting down worker...")
        self.running = False
        
        # Unload all models
        logger.info("Unloading models...")
        for model_name in list(self.model_manager.engines.keys()):
            result = self.model_manager.unload_model(model_name)
            if result["success"]:
                logger.info(f"Model unloaded: {model_name}")
        
        logger.info("Worker shutdown complete")


def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {signum}, initiating graceful shutdown...")
    sys.exit(0)


async def main():
    """Main entry point"""
    # Setup signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Create and start worker
    worker = WorkerService()
    
    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        raise
    finally:
        await worker.shutdown()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Worker stopped by user")
    except Exception as e:
        logger.error(f"Worker crashed: {e}")
        sys.exit(1)