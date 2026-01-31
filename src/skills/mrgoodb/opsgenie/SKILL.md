---
name: opsgenie
description: Manage incidents and on-call schedules via Opsgenie API. Create alerts and escalations.
metadata: {"clawdbot":{"emoji":"🚨","requires":{"env":["OPSGENIE_API_KEY"]}}}
---
# Opsgenie
Incident management.
## Environment
```bash
export OPSGENIE_API_KEY="xxxxxxxxxx"
```
## Create Alert
```bash
curl -X POST "https://api.opsgenie.com/v2/alerts" \
  -H "Authorization: GenieKey $OPSGENIE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Server down", "priority": "P1"}'
```
## List Alerts
```bash
curl "https://api.opsgenie.com/v2/alerts" -H "Authorization: GenieKey $OPSGENIE_API_KEY"
```
## Acknowledge Alert
```bash
curl -X POST "https://api.opsgenie.com/v2/alerts/{alertId}/acknowledge" \
  -H "Authorization: GenieKey $OPSGENIE_API_KEY"
```
## Links
- Docs: https://docs.opsgenie.com/docs/api-overview
