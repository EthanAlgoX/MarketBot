---
name: fullstory
description: Access session replays and analytics via FullStory API. Debug user experiences.
metadata: {"clawdbot":{"emoji":"📹","requires":{"env":["FULLSTORY_API_KEY"]}}}
---
# FullStory
Digital experience analytics.
## Environment
```bash
export FULLSTORY_API_KEY="xxxxxxxxxx"
```
## Search Sessions
```bash
curl -X POST "https://api.fullstory.com/v2/sessions/search" \
  -H "Authorization: Basic $FULLSTORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"filter": {"type": "And", "filters": [{"type": "Event", "name": "Error"}]}}'
```
## Get Session
```bash
curl "https://api.fullstory.com/v2/sessions/{sessionId}" \
  -H "Authorization: Basic $FULLSTORY_API_KEY"
```
## Set User Properties
```bash
curl -X POST "https://api.fullstory.com/v2/users" \
  -H "Authorization: Basic $FULLSTORY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"uid": "user123", "properties": {"displayName": "John Doe", "email": "john@example.com"}}'
```
## Links
- Dashboard: https://app.fullstory.com
- Docs: https://developer.fullstory.com
