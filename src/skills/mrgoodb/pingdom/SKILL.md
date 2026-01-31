---
name: pingdom
description: Monitor uptime and performance via Pingdom API. Manage checks and view reports.
metadata: {"clawdbot":{"emoji":"📡","requires":{"env":["PINGDOM_API_TOKEN"]}}}
---
# Pingdom
Uptime monitoring.
## Environment
```bash
export PINGDOM_API_TOKEN="xxxxxxxxxx"
```
## List Checks
```bash
curl "https://api.pingdom.com/api/3.1/checks" -H "Authorization: Bearer $PINGDOM_API_TOKEN"
```
## Get Check Results
```bash
curl "https://api.pingdom.com/api/3.1/results/{checkId}" -H "Authorization: Bearer $PINGDOM_API_TOKEN"
```
## Create Check
```bash
curl -X POST "https://api.pingdom.com/api/3.1/checks" \
  -H "Authorization: Bearer $PINGDOM_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Website", "host": "example.com", "type": "http"}'
```
## Links
- Docs: https://docs.pingdom.com/api/
