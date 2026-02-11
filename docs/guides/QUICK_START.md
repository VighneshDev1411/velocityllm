# 🚀 VelocityLLM - Quick Start Guide

## One Command to Start Everything

```bash
./start-all.sh
```

## What Gets Started

1. ✅ Backend API (port 8080)
2. ✅ Python Worker (port 50051)  
3. ✅ Frontend UI (port 3000)

## Access Points

- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **API Health**: http://localhost:8080/health

## Stop All Services

```bash
/tmp/stop-velocityllm.sh
```

## Test Everything

```bash
./test_all_features.sh
```

## Monitor Logs

```bash
# Backend
tail -f /tmp/velocityllm-backend.log

# Python Worker
tail -f /tmp/python-worker.log

# Frontend
tail -f /tmp/velocityllm-frontend.log
```

## UI Features

Navigate to http://localhost:3000 and explore:

1. **Dashboard** - Real-time system metrics
2. **Workers** - Worker pool monitoring
3. **Jobs** - Job history and status
4. **Streams** - Active streaming sessions

See `UI_TESTING_GUIDE.md` for detailed testing instructions.

---

**That's it!** Everything you need in one place. 🎉
