"""
VelocityLLM Health Monitor
Day 8: System health monitoring and metrics
"""

import time
import psutil
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
from loguru import logger


@dataclass
class HealthMetrics:
    """Health metrics snapshot"""
    timestamp: float = field(default_factory=time.time)
    
    # CPU
    cpu_percent: float = 0.0
    cpu_count: int = 0
    
    # Memory
    memory_percent: float = 0.0
    memory_used_mb: float = 0.0
    memory_total_mb: float = 0.0
    
    # GPU (if available)
    gpu_percent: float = 0.0
    gpu_memory_percent: float = 0.0
    gpu_memory_used_mb: float = 0.0
    gpu_memory_total_mb: float = 0.0
    gpu_available: bool = False
    
    # Process
    process_memory_mb: float = 0.0
    process_cpu_percent: float = 0.0
    
    # Request metrics
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    active_requests: int = 0


class HealthMonitor:
    """Monitors system and worker health"""
    
    def __init__(self):
        self.process = psutil.Process()
        self.start_time = time.time()
        
        # Metrics
        self.metrics = HealthMetrics()
        self.metrics.cpu_count = psutil.cpu_count()
        
        # Request tracking
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0
        self.active_requests = 0
        
        # GPU availability
        self.gpu_available = self._check_gpu_available()
        
        # Health status thresholds
        self.cpu_warning_threshold = 80.0
        self.cpu_critical_threshold = 95.0
        self.memory_warning_threshold = 80.0
        self.memory_critical_threshold = 95.0
        
        logger.info(
            f"Health monitor initialized "
            f"(CPU cores: {self.metrics.cpu_count}, GPU: {self.gpu_available})"
        )
    
    def _check_gpu_available(self) -> bool:
        """Check if GPU is available"""
        try:
            import GPUtil
            gpus = GPUtil.getGPUs()
            return len(gpus) > 0
        except:
            try:
                import torch
                return torch.cuda.is_available()
            except:
                return False
    
    def update_metrics(self):
        """Update all health metrics"""
        # CPU
        self.metrics.cpu_percent = psutil.cpu_percent(interval=0.1)
        
        # Memory
        memory = psutil.virtual_memory()
        self.metrics.memory_percent = memory.percent
        self.metrics.memory_used_mb = memory.used / (1024 * 1024)
        self.metrics.memory_total_mb = memory.total / (1024 * 1024)
        
        # Process metrics
        self.metrics.process_memory_mb = self.process.memory_info().rss / (1024 * 1024)
        try:
            self.metrics.process_cpu_percent = self.process.cpu_percent(interval=0.1)
        except:
            self.metrics.process_cpu_percent = 0.0
        
        # GPU metrics
        if self.gpu_available:
            self._update_gpu_metrics()
        
        # Request metrics
        self.metrics.total_requests = self.total_requests
        self.metrics.successful_requests = self.successful_requests
        self.metrics.failed_requests = self.failed_requests
        self.metrics.active_requests = self.active_requests
        
        self.metrics.timestamp = time.time()
    
    def _update_gpu_metrics(self):
        """Update GPU metrics"""
        try:
            import GPUtil
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]  # Use first GPU
                self.metrics.gpu_percent = gpu.load * 100
                self.metrics.gpu_memory_percent = gpu.memoryUtil * 100
                self.metrics.gpu_memory_used_mb = gpu.memoryUsed
                self.metrics.gpu_memory_total_mb = gpu.memoryTotal
                self.metrics.gpu_available = True
        except:
            try:
                import torch
                if torch.cuda.is_available():
                    # Get memory info
                    mem_allocated = torch.cuda.memory_allocated(0) / (1024 * 1024)
                    mem_reserved = torch.cuda.memory_reserved(0) / (1024 * 1024)
                    
                    # Get total memory
                    props = torch.cuda.get_device_properties(0)
                    mem_total = props.total_memory / (1024 * 1024)
                    
                    self.metrics.gpu_memory_used_mb = mem_allocated
                    self.metrics.gpu_memory_total_mb = mem_total
                    self.metrics.gpu_memory_percent = (mem_allocated / mem_total) * 100
                    self.metrics.gpu_available = True
                    
                    # GPU utilization (approximation)
                    self.metrics.gpu_percent = min(
                        (mem_reserved / mem_total) * 100, 
                        100.0
                    )
            except:
                pass
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get current health status"""
        self.update_metrics()
        
        # Determine overall health status
        status = "healthy"
        
        # Check CPU
        if self.metrics.cpu_percent >= self.cpu_critical_threshold:
            status = "critical"
        elif self.metrics.cpu_percent >= self.cpu_warning_threshold:
            status = "degraded" if status == "healthy" else status
        
        # Check memory
        if self.metrics.memory_percent >= self.memory_critical_threshold:
            status = "critical"
        elif self.metrics.memory_percent >= self.memory_warning_threshold:
            status = "degraded" if status == "healthy" else status
        
        # Check GPU memory if available
        if self.metrics.gpu_available:
            if self.metrics.gpu_memory_percent >= 95.0:
                status = "critical"
            elif self.metrics.gpu_memory_percent >= 85.0:
                status = "degraded" if status == "healthy" else status
        
        return {
            "status": status,
            "timestamp": self.metrics.timestamp,
            "uptime_seconds": int(time.time() - self.start_time),
            
            # CPU
            "cpu_percent": self.metrics.cpu_percent,
            "cpu_count": self.metrics.cpu_count,
            
            # Memory
            "memory_percent": self.metrics.memory_percent,
            "memory_used_mb": self.metrics.memory_used_mb,
            "memory_total_mb": self.metrics.memory_total_mb,
            
            # GPU
            "gpu_available": self.metrics.gpu_available,
            "gpu_percent": self.metrics.gpu_percent,
            "gpu_memory_percent": self.metrics.gpu_memory_percent,
            "gpu_memory_used_mb": self.metrics.gpu_memory_used_mb,
            "gpu_memory_total_mb": self.metrics.gpu_memory_total_mb,
            
            # Process
            "process_memory_mb": self.metrics.process_memory_mb,
            "process_cpu_percent": self.metrics.process_cpu_percent,
            
            # Requests
            "total_requests": self.metrics.total_requests,
            "successful_requests": self.metrics.successful_requests,
            "failed_requests": self.metrics.failed_requests,
            "active_requests": self.metrics.active_requests,
            "success_rate": self._calculate_success_rate(),
        }
    
    def record_request(self, success: bool = True):
        """Record a request"""
        self.total_requests += 1
        if success:
            self.successful_requests += 1
        else:
            self.failed_requests += 1
    
    def increment_active_requests(self):
        """Increment active request counter"""
        self.active_requests += 1
    
    def decrement_active_requests(self):
        """Decrement active request counter"""
        self.active_requests = max(0, self.active_requests - 1)
    
    def _calculate_success_rate(self) -> float:
        """Calculate success rate"""
        if self.total_requests == 0:
            return 100.0
        return (self.successful_requests / self.total_requests) * 100.0
    
    def get_detailed_metrics(self) -> Dict[str, Any]:
        """Get detailed metrics"""
        self.update_metrics()
        
        return {
            "timestamp": self.metrics.timestamp,
            "uptime_seconds": int(time.time() - self.start_time),
            
            "system": {
                "cpu": {
                    "percent": self.metrics.cpu_percent,
                    "count": self.metrics.cpu_count,
                },
                "memory": {
                    "percent": self.metrics.memory_percent,
                    "used_mb": self.metrics.memory_used_mb,
                    "total_mb": self.metrics.memory_total_mb,
                    "available_mb": self.metrics.memory_total_mb - self.metrics.memory_used_mb,
                },
            },
            
            "gpu": {
                "available": self.metrics.gpu_available,
                "utilization_percent": self.metrics.gpu_percent,
                "memory": {
                    "percent": self.metrics.gpu_memory_percent,
                    "used_mb": self.metrics.gpu_memory_used_mb,
                    "total_mb": self.metrics.gpu_memory_total_mb,
                    "available_mb": self.metrics.gpu_memory_total_mb - self.metrics.gpu_memory_used_mb,
                }
            } if self.metrics.gpu_available else None,
            
            "process": {
                "memory_mb": self.metrics.process_memory_mb,
                "cpu_percent": self.metrics.process_cpu_percent,
            },
            
            "requests": {
                "total": self.metrics.total_requests,
                "successful": self.metrics.successful_requests,
                "failed": self.metrics.failed_requests,
                "active": self.metrics.active_requests,
                "success_rate": self._calculate_success_rate(),
            }
        }
    
    def is_healthy(self) -> bool:
        """Check if system is healthy"""
        status = self.get_health_status()
        return status["status"] in ["healthy", "degraded"]
    
    def get_resource_usage_summary(self) -> str:
        """Get human-readable resource usage summary"""
        self.update_metrics()
        
        summary = (
            f"CPU: {self.metrics.cpu_percent:.1f}% | "
            f"Memory: {self.metrics.memory_percent:.1f}% "
            f"({self.metrics.memory_used_mb:.0f}/{self.metrics.memory_total_mb:.0f} MB)"
        )
        
        if self.metrics.gpu_available:
            summary += (
                f" | GPU: {self.metrics.gpu_percent:.1f}% | "
                f"GPU Memory: {self.metrics.gpu_memory_percent:.1f}% "
                f"({self.metrics.gpu_memory_used_mb:.0f}/{self.metrics.gpu_memory_total_mb:.0f} MB)"
            )
        
        return summary


if __name__ == "__main__":
    # Test health monitor
    monitor = HealthMonitor()
    
    import json
    print("\n=== Health Status ===")
    print(json.dumps(monitor.get_health_status(), indent=2))
    
    print("\n=== Detailed Metrics ===")
    print(json.dumps(monitor.get_detailed_metrics(), indent=2))
    
    print("\n=== Resource Summary ===")
    print(monitor.get_resource_usage_summary())