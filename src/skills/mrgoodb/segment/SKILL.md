---
name: segment
description: Track events and manage customer data via Segment API. Route data to destinations.
metadata: {"clawdbot":{"emoji":"📊","requires":{"env":["SEGMENT_WRITE_KEY"]}}}
---
# Segment
Customer data platform.
## Environment
```bash
export SEGMENT_WRITE_KEY="xxxxxxxxxx"
```
## Track Event
```bash
curl -X POST "https://api.segment.io/v1/track" \
  -u "$SEGMENT_WRITE_KEY:" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "event": "Order Completed", "properties": {"revenue": 99.99}}'
```
## Identify User
```bash
curl -X POST "https://api.segment.io/v1/identify" \
  -u "$SEGMENT_WRITE_KEY:" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "traits": {"email": "user@example.com", "plan": "premium"}}'
```
## Page View
```bash
curl -X POST "https://api.segment.io/v1/page" \
  -u "$SEGMENT_WRITE_KEY:" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "name": "Home", "properties": {"url": "https://example.com"}}'
```
## Links
- Dashboard: https://app.segment.com
- Docs: https://segment.com/docs/connections/sources/catalog/libraries/server/http-api/
