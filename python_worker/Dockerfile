# VelocityLLM Python Worker Dockerfile
FROM python:3.10-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements-lite.txt .
RUN pip install --no-cache-dir -r requirements-lite.txt

# Copy application code
COPY . .

# Expose gRPC port
EXPOSE 50051

# Default command: run the test server (lightweight mock)
# Change to "python main.py" for the real worker (requires full requirements.txt)
CMD ["python", "test_server.py"]
