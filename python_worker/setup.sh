#!/bin/bash

# VelocityLLM Python Worker Setup Script
# Day 8: Automated setup for Python worker

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║    VelocityLLM Python Worker - Setup Script             ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Python version
echo -e "${YELLOW}Checking Python version...${NC}"
python_version=$(python3 --version 2>&1 | awk '{print $2}')
required_version="3.10"

if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 10) else 1)" 2>/dev/null; then
    echo -e "${RED}✗ Python 3.10+ required, found $python_version${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python version: $python_version${NC}"
echo ""

# Create virtual environment
echo -e "${YELLOW}Creating virtual environment...${NC}"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
else
    echo -e "${GREEN}✓ Virtual environment already exists${NC}"
fi
echo ""

# Activate virtual environment
echo -e "${YELLOW}Activating virtual environment...${NC}"
source venv/bin/activate
echo -e "${GREEN}✓ Virtual environment activated${NC}"
echo ""

# Upgrade pip
echo -e "${YELLOW}Upgrading pip...${NC}"
pip install --upgrade pip -q
echo -e "${GREEN}✓ pip upgraded${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
echo "This may take several minutes for vLLM and PyTorch..."
pip install -r requirements.txt -q --no-cache-dir || pip install -r requirements.txt

echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Check if proto directory exists
echo -e "${YELLOW}Checking for proto files...${NC}"
if [ ! -f "../proto/inference.proto" ]; then
    echo -e "${RED}✗ Proto file not found at ../proto/inference.proto${NC}"
    echo "Please make sure you're in the python_worker directory"
    exit 1
fi
echo -e "${GREEN}✓ Proto file found${NC}"
echo ""

# Generate protobuf files
echo -e "${YELLOW}Generating Protocol Buffer files...${NC}"
python -m grpc_tools.protoc \
    -I../proto \
    --python_out=. \
    --grpc_python_out=. \
    ../proto/inference.proto

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Protocol Buffer files generated${NC}"
else
    echo -e "${RED}✗ Failed to generate Protocol Buffer files${NC}"
    exit 1
fi
echo ""

# Check CUDA availability
echo -e "${YELLOW}Checking CUDA availability...${NC}"
cuda_available=$(python3 -c "import torch; print(torch.cuda.is_available())" 2>/dev/null || echo "False")

if [ "$cuda_available" = "True" ]; then
    cuda_version=$(python3 -c "import torch; print(torch.version.cuda)" 2>/dev/null || echo "Unknown")
    gpu_count=$(python3 -c "import torch; print(torch.cuda.device_count())" 2>/dev/null || echo "0")
    echo -e "${GREEN}✓ CUDA available${NC}"
    echo "  CUDA Version: $cuda_version"
    echo "  GPU Count: $gpu_count"
else
    echo -e "${YELLOW}! CUDA not available - worker will run on CPU${NC}"
    echo "  For GPU support, install CUDA toolkit and GPU-enabled PyTorch"
fi
echo ""

# Test imports
echo -e "${YELLOW}Testing imports...${NC}"
python3 -c "
import sys
errors = []

try:
    import grpc
except ImportError as e:
    errors.append(f'gRPC: {e}')

try:
    import vllm
except ImportError as e:
    errors.append(f'vLLM: {e}')

try:
    import torch
except ImportError as e:
    errors.append(f'PyTorch: {e}')

try:
    import loguru
except ImportError as e:
    errors.append(f'Loguru: {e}')

if errors:
    print('✗ Import errors:')
    for error in errors:
        print(f'  - {error}')
    sys.exit(1)
else:
    print('✓ All imports successful')
"

if [ $? -ne 0 ]; then
    echo -e "${RED}Import test failed${NC}"
    exit 1
fi
echo ""

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > .env << EOF
# VelocityLLM Python Worker Configuration

# Server Configuration
GRPC_HOST=0.0.0.0
GRPC_PORT=50051

# Worker Configuration
WORKER_ID=worker-python-1
LOG_LEVEL=INFO

# Device Configuration
# Options: cuda, cpu, auto
DEVICE=auto

# Model Configuration (optional)
# DEFAULT_MODEL=gpt2
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${GREEN}✓ .env file already exists${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Setup Complete! 🎉                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Activate virtual environment:"
echo "   source venv/bin/activate"
echo ""
echo "2. (Optional) Edit configuration:"
echo "   nano .env"
echo ""
echo "3. Start the worker:"
echo "   python main.py"
echo ""
echo "4. Test from Go server:"
echo "   curl http://localhost:8080/api/v1/worker/jobs ..."
echo ""
echo -e "${YELLOW}Documentation:${NC} See README.md for detailed usage"
echo ""