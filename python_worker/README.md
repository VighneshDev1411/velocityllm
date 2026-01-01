# VelocityLLM Python Worker

Python gRPC worker for high-performance LLM inference using vLLM.

## 📋 Features

- ✅ **vLLM Integration**: High-throughput LLM inference
- ✅ **gRPC Server**: Fast, type-safe communication with Go
- ✅ **Model Management**: Load/unload models dynamically
- ✅ **Streaming Support**: Real-time token streaming
- ✅ **GPU Support**: Optimized for NVIDIA GPUs
- ✅ **Health Monitoring**: System and GPU health tracking
- ✅ **Multiple Models**: Support for various LLM models

## 🚀 Quick Start

### 1. Prerequisites

- Python 3.10+
- NVIDIA GPU (optional, for production)
- CUDA 12.1+ (if using GPU)

### 2. Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Generate Protocol Buffer files (from project root)
cd ..
python -m grpc_tools.protoc -I./proto \
    --python_out=./python_worker \
    --grpc_python_out=./python_worker \
    ./proto/inference.proto
```

### 3. Configuration

Edit `config.py` or set environment variables:

```bash
# Server configuration
export GRPC_HOST="0.0.0.0"
export GRPC_PORT="50051"

# Worker configuration
export WORKER_ID="worker-python-1"
export LOG_LEVEL="INFO"

# Device configuration
export DEVICE="cuda"  # or "cpu" for CPU-only
```

### 4. Run Worker

```bash
python main.py
```

Expected output:
```
2024-01-01 12:00:00 | INFO     | Initializing VelocityLLM Python Worker
2024-01-01 12:00:00 | INFO     | Health monitor initialized (CPU cores: 16, GPU: True)
2024-01-01 12:00:00 | INFO     | Model manager initialized
2024-01-01 12:00:00 | INFO     | Pre-loading default model: gpt2
2024-01-01 12:00:05 | INFO     | Default model loaded: gpt2
======================================================================
🚀 VelocityLLM Python Worker Starting
======================================================================
Worker ID: worker-python-1
gRPC Server: 0.0.0.0:50051
Max Workers: 10
GPU Available: True
Loaded Models: 1
======================================================================
2024-01-01 12:00:05 | INFO     | Starting gRPC server on 0.0.0.0:50051
2024-01-01 12:00:05 | INFO     | ✅ gRPC server started successfully on 0.0.0.0:50051
```

## 📁 Project Structure

```
python_worker/
├── main.py                 # Entry point
├── config.py              # Configuration
├── grpc_server.py         # gRPC server implementation
├── inference_engine.py    # vLLM wrapper
├── health_monitor.py      # Health monitoring
├── requirements.txt       # Python dependencies
└── proto/                 # Generated protobuf files
    ├── inference_pb2.py
    └── inference_pb2_grpc.py
```

## 🔧 Configuration

### Server Settings

```python
ServerConfig(
    host="0.0.0.0",                    # Server host
    port=50051,                        # Server port
    max_workers=10,                    # gRPC worker threads
    max_concurrent_rpcs=100,           # Max concurrent RPCs
    keepalive_time_ms=30000,           # Keepalive time
    max_send_message_length=100MB,     # Max message size
)
```

### Model Settings

```python
ModelConfig(
    model_name="llama-2-7b",
    model_path="meta-llama/Llama-2-7b-hf",
    device="auto",                     # cuda, cpu, auto
    tensor_parallel_size=1,            # Tensor parallelism
    gpu_memory_utilization=0.9,        # GPU memory fraction
    max_model_len=4096,                # Max sequence length
    enable_prefix_caching=True,        # Enable caching
)
```

### Inference Settings

```python
InferenceConfig(
    default_max_tokens=512,
    default_temperature=0.7,
    default_top_p=0.95,
    default_top_k=50,
    max_tokens_limit=4096,
)
```

## 🎯 Supported Models

Pre-configured models:

- **GPT-2**: Small model for testing (default)
- **Llama-2-7B**: High-quality open model
- **Mistral-7B**: Efficient 7B model
- **Custom**: Add your own models in config.py

## 📊 Health Monitoring

The worker monitors:

- **CPU Usage**: System and process CPU
- **Memory Usage**: RAM utilization
- **GPU Usage**: GPU utilization and memory
- **Request Metrics**: Success rate, latency
- **Model Status**: Loaded models and memory

Access health status via gRPC:
```python
health_status = client.HealthCheck(detailed=True)
```

## 🔍 Testing

### Test Individual Components

```bash
# Test configuration
python config.py

# Test health monitor
python health_monitor.py

# Test inference engine (requires model)
python -c "from inference_engine import *; print('OK')"
```

### Test with Go Client

From the Go side:
```bash
go run cmd/server/main.go
```

Then submit jobs through the Go API.

## 🐛 Troubleshooting

### GPU Not Detected

```bash
# Check CUDA installation
nvidia-smi

# Check PyTorch GPU support
python -c "import torch; print(torch.cuda.is_available())"

# Install CUDA toolkit
pip install nvidia-cuda-runtime-cu12
```

### Model Loading Fails

```bash
# Check model path
ls ~/.cache/huggingface/hub/

# Clear cache
rm -rf ~/.cache/huggingface/

# Download model manually
huggingface-cli download meta-llama/Llama-2-7b-hf
```

### Out of Memory

```bash
# Reduce GPU memory utilization
export GPU_MEMORY_UTILIZATION=0.7

# Use smaller model
# Edit config.py and use gpt2 instead of larger models

# Enable quantization
# Set quantization="awq" or "gptq" in ModelConfig
```

### gRPC Connection Failed

```bash
# Check if port is open
netstat -tulpn | grep 50051

# Check firewall
sudo ufw allow 50051

# Test connectivity
grpc_cli call localhost:50051 HealthCheck ""
```

## 📈 Performance Tuning

### For Maximum Throughput

```python
# Use larger batch sizes
max_num_seqs=256
max_num_batched_tokens=4096

# Enable optimizations
enable_prefix_caching=True
enforce_eager=False  # Use CUDA graphs

# Use tensor parallelism
tensor_parallel_size=2  # For multi-GPU
```

### For Low Latency

```python
# Smaller batch sizes
max_num_seqs=64

# Disable CUDA graphs
enforce_eager=True

# Use faster models
# GPT-2, Mistral-7B instead of Llama-70B
```

### For Memory Efficiency

```python
# Reduce memory usage
gpu_memory_utilization=0.7

# Use quantization
quantization="awq"  # or "gptq"

# Smaller context
max_model_len=2048
```

## 🔐 Security Notes

- **No Authentication**: Current implementation has no auth
  - Add in production: TLS, API keys, OAuth
- **Model Access**: Restrict model paths
- **Resource Limits**: Set appropriate limits
- **Logging**: Don't log sensitive data

## 📝 Development

### Adding New Models

```python
# In config.py
self.models["my-model"] = ModelConfig(
    model_name="my-model",
    model_path="path/to/model",
    device="cuda",
    max_model_len=4096,
)
```

### Custom Inference Logic

Edit `inference_engine.py`:
```python
def inference(self, request: InferenceRequest):
    # Add preprocessing
    prompt = preprocess(request.prompt)
    
    # Custom sampling
    sampling_params = custom_sampling(request)
    
    # Generate
    outputs = self.llm.generate([prompt], sampling_params)
    
    # Add postprocessing
    result = postprocess(outputs[0])
    
    return result
```

## 📚 Resources

- [vLLM Documentation](https://docs.vllm.ai/)
- [gRPC Python Guide](https://grpc.io/docs/languages/python/)
- [Hugging Face Models](https://huggingface.co/models)

## 🤝 Integration with Go

The Python worker integrates with the Go server:

```
Go Server (Port 8080)          Python Worker (Port 50051)
     │                                  │
     │  1. Submit Job                   │
     ├─────────────────────────────────>│
     │                                  │
     │  2. gRPC Inference Request       │
     ├─────────────────────────────────>│
     │                                  │
     │  3. vLLM Processing              │
     │                               [Model]
     │                                  │
     │  4. Stream Tokens Back           │
     │<─────────────────────────────────┤
     │                                  │
     │  5. Return to Client             │
     └──────────>                       │
```

## ⚠️ Important Notes

- **Resource Requirements**: Large models need significant RAM/VRAM
- **Startup Time**: Model loading can take 30s-2min
- **GPU Memory**: Monitor usage to avoid OOM
- **Production**: Add proper error handling, monitoring, auth

## 📧 Support

For issues or questions about the Python worker, check the main project documentation.

---

**Day 8 Complete!** Python worker ready for LLM inference 🚀