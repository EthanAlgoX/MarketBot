---
name: datadog
description: Monitor infrastructure and applications via Datadog API. Query metrics, manage dashboards, and create alerts.
metadata: {"clawdbot":{"emoji":"🐕","requires":{"env":["DD_API_KEY","DD_APP_KEY"]}}}
---

# Datadog

Infrastructure monitoring.

## Environment

```bash
export DD_API_KEY="xxxxxxxxxx"
export DD_APP_KEY="xxxxxxxxxx"
export DD_SITE="datadoghq.com"  # or datadoghq.eu, us3.datadoghq.com, etc.
```

## Submit Metrics

```bash
curl -X POST "https://api.$DD_SITE/api/v2/series" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "series": [{
      "metric": "custom.metric",
      "type": 0,
      "points": [{"timestamp": '$(date +%s)', "value": 42}],
      "tags": ["env:prod"]
    }]
  }'
```

## Query Metrics

```bash
curl "https://api.$DD_SITE/api/v1/query?from=$(date -d '1 hour ago' +%s)&to=$(date +%s)&query=avg:system.cpu.user{*}" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "DD-APPLICATION-KEY: $DD_APP_KEY"
```

## List Monitors

```bash
curl "https://api.$DD_SITE/api/v1/monitor" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "DD-APPLICATION-KEY: $DD_APP_KEY"
```

## Create Monitor

```bash
curl -X POST "https://api.$DD_SITE/api/v1/monitor" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CPU High Alert",
    "type": "metric alert",
    "query": "avg(last_5m):avg:system.cpu.user{*} > 90",
    "message": "CPU usage is above 90%!"
  }'
```

## Send Event

```bash
curl -X POST "https://api.$DD_SITE/api/v1/events" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Deployment", "text": "Deployed v1.2.3", "tags": ["env:prod"]}'
```

## List Dashboards

```bash
curl "https://api.$DD_SITE/api/v1/dashboard" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "DD-APPLICATION-KEY: $DD_APP_KEY"
```

## Links
- Dashboard: https://app.datadoghq.com
- Docs: https://docs.datadoghq.com/api
