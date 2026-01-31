# OpenBio API Reference

Core API endpoints for tool discovery, invocation, and job management.

## Authentication

All requests require `OPENBIO_API_KEY` in the `X-API-Key` header:

```bash
-H "X-API-Key: $OPENBIO_API_KEY"
```

**Base URL**: `https://openbio-api.fly.dev/`

## Critical: Always Check Tool Schema

Before invoking ANY tool, get its schema:

```bash
curl -X GET "https://openbio-api.fly.dev/api/v1/tools/{tool_name}" \
  -H "X-API-Key: $OPENBIO_API_KEY"
```

**Why?** Parameter names vary:
- Some use `pdb_id`, others use `pdb_ids` (array)
- Some use `uniprot_id`, others use `uniprot_accession`
- Schemas show required vs optional parameters

## Endpoints

### List All Tools

```bash
curl -X GET "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY"
```

Response (truncated):
```json
{
  "tools": [
    {
      "name": "search_pubmed",
      "simple_name": "PubMed Search",
      "description": "Search PubMed literature...",
      "category": "pubmed",
      "is_long_running": false
    }
  ],
  "total": 120
}
```

### Search Tools by Capability

Don't know which tool to use? Search:

```bash
curl -X GET "https://openbio-api.fly.dev/api/v1/tools/search?q=protein+structure" \
  -H "X-API-Key: $OPENBIO_API_KEY"
```

### List Categories

```bash
curl -X GET "https://openbio-api.fly.dev/api/v1/tools/categories" \
  -H "X-API-Key: $OPENBIO_API_KEY"
```

### Get Tool Schema

```bash
curl -X GET "https://openbio-api.fly.dev/api/v1/tools/{tool_name}" \
  -H "X-API-Key: $OPENBIO_API_KEY"
```

Response:
```json
{
  "name": "search_pubmed",
  "description": "Search PubMed...",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {"type": "string"},
      "max_results": {"type": "integer", "default": 10}
    },
    "required": ["query"]
  }
}
```

### Invoke a Tool

```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F "tool_name=search_pubmed" \
  -F 'params={"query": "CRISPR gene editing", "max_results": 5}'
```

Response:
```json
{
  "success": true,
  "tool_name": "search_pubmed",
  "data": { ... },
  "execution_time_ms": 2450
}
```

### File Uploads

Some tools accept files:

```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=analyze_pdb_file" \
  -F 'params={}' \
  -F "pdb_file=@/path/to/structure.pdb"
```

**Max file size**: 50MB

## Long-Running Jobs

Tools prefixed with `submit_` are long-running (predictions, large analyses).

### Submit Job

```bash
curl -X POST "https://openbio-api.fly.dev/api/v1/tools" \
  -H "X-API-Key: $OPENBIO_API_KEY" \
  -F "tool_name=submit_boltz_prediction" \
  -F 'params={"sequences": [{"type": "protein", "sequence": "MVLSPADKTNVK..."}]}'
```

Response:
```json
{
  "success": true,
  "data": {
    "job_id": "boltz_abc123",
    "status": "submitted"
  }
}
```

### Check Job Status (Quick)

```bash
curl -X GET "https://openbio-api.fly.dev/api/v1/jobs/{job_id}/status" \
  -H "X-API-Key: $OPENBIO_API_KEY"
```

Response:
```json
{
  "success": true,
  "job_id": "boltz_abc123",
  "status": "completed"
}
```

### Get Job Results with Download URLs

```bash
curl -X GET "https://openbio-api.fly.dev/api/v1/jobs/{job_id}" \
  -H "X-API-Key: $OPENBIO_API_KEY"
```

Response:
```json
{
  "success": true,
  "job": {
    "job_id": "boltz_abc123",
    "status": "completed",
    "tool_name": "submit_boltz_prediction",
    "output_files": {
      "structure": "predictions/boltz_abc123/model.cif",
      "confidence": "predictions/boltz_abc123/confidence.json"
    }
  },
  "output_files_signed_urls": {
    "structure": "https://s3.amazonaws.com/...signed-url...",
    "confidence": "https://s3.amazonaws.com/...signed-url..."
  }
}
```

**Download files** using signed URLs (valid 1 hour):
```bash
curl -o model.cif "https://s3.amazonaws.com/...signed-url..."
```

### List Your Jobs

```bash
curl -X GET "https://openbio-api.fly.dev/api/v1/jobs?limit=10&status=completed" \
  -H "X-API-Key: $OPENBIO_API_KEY"
```

Query parameters:
- `limit`: Max results (default 50, max 100)
- `offset`: Pagination offset
- `status`: Filter by status
- `tool`: Filter by tool name

## Job Polling Strategy

```bash
# Recommended polling with exponential backoff
WAIT=10
MAX_WAIT=60

while true; do
  STATUS=$(curl -s "https://openbio-api.fly.dev/api/v1/jobs/$JOB_ID/status" \
    -H "X-API-Key: $OPENBIO_API_KEY" | jq -r '.status')
  
  if [ "$STATUS" = "completed" ]; then
    echo "Job completed!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Job failed"
    exit 1
  fi
  
  sleep $WAIT
  WAIT=$((WAIT * 2 > MAX_WAIT ? MAX_WAIT : WAIT * 2))
done
```

## Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad request | Check parameter format |
| 401 | Unauthorized | Check API key |
| 404 | Not found | Check tool name or job ID |
| 429 | Rate limited | Wait and retry |
| 500 | Server error | Retry or contact support |

### Error Response Format

```json
{
  "success": false,
  "tool_name": "search_pubmed",
  "data": null,
  "message": "Tool execution failed: validation error..."
}
```

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| GET /tools | 60/min |
| GET /tools/search | 60/min |
| POST /tools | 30/min |
| GET /jobs | 10/min |

## Common Patterns

### Pattern 1: Discover → Schema → Invoke

```bash
# 1. Find tools for your task
curl -s "...api/v1/tools/search?q=protein" -H "X-API-Key: $KEY" | jq '.results[:3]'

# 2. Get schema for chosen tool
curl -s "...api/v1/tools/fetch_pdb_metadata" -H "X-API-Key: $KEY" | jq '.parameters'

# 3. Invoke with correct params
curl -X POST "...api/v1/tools" -H "X-API-Key: $KEY" \
  -F "tool_name=fetch_pdb_metadata" \
  -F 'params={"pdb_ids": ["1MBO"]}'
```

### Pattern 2: Submit → Poll → Download

```bash
# 1. Submit job
JOB_ID=$(curl -s -X POST "...api/v1/tools" -H "X-API-Key: $KEY" \
  -F "tool_name=submit_boltz_prediction" \
  -F 'params={...}' | jq -r '.data.job_id')

# 2. Poll until complete
while [ "$(curl -s "...api/v1/jobs/$JOB_ID/status" -H "X-API-Key: $KEY" | jq -r '.status')" != "completed" ]; do
  sleep 30
done

# 3. Get download URLs
curl -s "...api/v1/jobs/$JOB_ID" -H "X-API-Key: $KEY" | jq '.output_files_signed_urls'
```

---

**Remember**: Always check tool schema before invoking to avoid parameter errors.
