# API Examples

## Create Request

```bash
curl -X POST http://localhost:8080/api/v1/requests \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "prompt": "Explain machine learning",
    "tokens_prompt": 5,
    "status": "pending",
    "provider": "openai"
  }'
```

## List Requests

```bash
# First page
curl "http://localhost:8080/api/v1/requests?limit=10&offset=0"

# Second page
curl "http://localhost:8080/api/v1/requests?limit=10&offset=10"
```

## Get Statistics

```bash
curl http://localhost:8080/api/v1/requests/stats | python3 -m json.tool
```

## Response Format

All responses follow this structure:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2025-10-26T..."
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2025-10-26T..."
}
```
