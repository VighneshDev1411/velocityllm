# VelocityLLM Docker Setup

This guide explains how to run VelocityLLM using Docker containers.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose (included with Docker Desktop)

## Quick Start

### 1. Set up environment variables

Create a `.env` file in the project root with your API keys:

```bash
# LLM Provider API Keys
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# OAuth2 (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 2. Start all services

```bash
docker-compose up -d
```

This will start:
- **PostgreSQL** (port 5432) - Database
- **Redis** (port 6379) - Cache
- **Backend API** (port 8080) - Go server
- **Frontend** (port 3000) - Next.js app

### 3. Access the application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **API Docs**: http://localhost:8080/health

### 4. View logs

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
docker-compose logs -f redis
```

### 5. Stop all services

```bash
docker-compose down
```

## Useful Commands

### Rebuild after code changes

```bash
# Rebuild backend
docker-compose build backend

# Rebuild frontend
docker-compose build frontend

# Rebuild all
docker-compose build

# Rebuild and restart
docker-compose up -d --build
```

### Reset database (careful!)

```bash
docker-compose down -v  # This deletes all data!
docker-compose up -d
```

### Access database directly

```bash
docker exec -it velocityllm-postgres psql -U velocityllm -d velocityllm
```

### Access Redis CLI

```bash
docker exec -it velocityllm-redis redis-cli
```

### Check service status

```bash
docker-compose ps
```

## Services Overview

| Service | Container Name | Port | Purpose |
|---------|---------------|------|---------|
| postgres | velocityllm-postgres | 5432 | PostgreSQL database |
| redis | velocityllm-redis | 6379 | Redis cache |
| backend | velocityllm-backend | 8080 | Go API server |
| frontend | velocityllm-frontend | 3000 | Next.js web app |

## Production Deployment

For production, make sure to:

1. **Change database credentials** in `docker-compose.yml`
2. **Set a strong JWT secret** (not the default one)
3. **Use environment-specific `.env` files**
4. **Enable HTTPS** with a reverse proxy (nginx/traefik)
5. **Set up database backups**
6. **Configure proper logging and monitoring**

## Troubleshooting

### Backend won't start

Check logs: `docker-compose logs backend`

Common issues:
- Database connection failed → Ensure postgres is healthy
- Missing API keys → Check `.env` file

### Frontend can't reach backend

- Ensure backend is running: `docker-compose ps`
- Check network: `docker network ls`
- Verify `NEXT_PUBLIC_API_URL` in frontend container

### Database connection errors

```bash
# Check postgres is running
docker-compose ps postgres

# Check postgres logs
docker-compose logs postgres

# Test connection
docker exec -it velocityllm-postgres pg_isready -U velocityllm
```

### Port already in use

If port 3000, 8080, 5432, or 6379 is already in use:

1. Stop the conflicting service
2. Or change the port in `docker-compose.yml`:
   ```yaml
   ports:
     - "3001:3000"  # Maps host port 3001 to container port 3000
   ```

## Development Workflow

### Hot reload (without Docker)

For faster development, you can run services separately:

```bash
# Start only database and redis
docker-compose up -d postgres redis

# Run backend locally
go run cmd/server/main.go

# Run frontend locally (in another terminal)
cd frontend && npm run dev
```

This gives you hot-reload for both backend and frontend while using dockerized database and cache.
