---
name: pagerduty
description: Manage incidents, on-call schedules, and alerts via PagerDuty API. Trigger and resolve incidents programmatically.
metadata: {"clawdbot":{"emoji":"🚨","requires":{"env":["PAGERDUTY_API_KEY"]}}}
---

# PagerDuty

Incident management.

## Environment

```bash
export PAGERDUTY_API_KEY="u+xxxxxxxxxx"
export PAGERDUTY_SERVICE_ID="PXXXXXX"
export PAGERDUTY_ROUTING_KEY="xxxxxxxxxx"  # For Events API
```

## Trigger Incident (Events API v2)

```bash
curl -X POST "https://events.pagerduty.com/v2/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "routing_key": "'$PAGERDUTY_ROUTING_KEY'",
    "event_action": "trigger",
    "dedup_key": "incident-123",
    "payload": {
      "summary": "Server CPU at 95%",
      "severity": "critical",
      "source": "monitoring-system"
    }
  }'
```

## Resolve Incident

```bash
curl -X POST "https://events.pagerduty.com/v2/enqueue" \
  -H "Content-Type: application/json" \
  -d '{
    "routing_key": "'$PAGERDUTY_ROUTING_KEY'",
    "event_action": "resolve",
    "dedup_key": "incident-123"
  }'
```

## List Incidents

```bash
curl "https://api.pagerduty.com/incidents?statuses[]=triggered&statuses[]=acknowledged" \
  -H "Authorization: Token token=$PAGERDUTY_API_KEY"
```

## Get On-Call

```bash
curl "https://api.pagerduty.com/oncalls" \
  -H "Authorization: Token token=$PAGERDUTY_API_KEY"
```

## List Services

```bash
curl "https://api.pagerduty.com/services" \
  -H "Authorization: Token token=$PAGERDUTY_API_KEY"
```

## Links
- Dashboard: https://app.pagerduty.com
- Docs: https://developer.pagerduty.com
