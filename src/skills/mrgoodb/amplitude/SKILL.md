---
name: amplitude
description: Track events and analyze product usage via Amplitude API. Query user behavior, cohorts, and funnels.
metadata: {"clawdbot":{"emoji":"📈","requires":{"env":["AMPLITUDE_API_KEY","AMPLITUDE_SECRET_KEY"]}}}
---

# Amplitude

Product analytics platform.

## Environment

```bash
export AMPLITUDE_API_KEY="xxxxxxxxxx"
export AMPLITUDE_SECRET_KEY="xxxxxxxxxx"
```

## Track Event (HTTP API)

```bash
curl -X POST "https://api2.amplitude.com/2/httpapi" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "'$AMPLITUDE_API_KEY'",
    "events": [{
      "user_id": "user123",
      "event_type": "Button Clicked",
      "event_properties": {"button_name": "signup"}
    }]
  }'
```

## Batch Track Events

```bash
curl -X POST "https://api2.amplitude.com/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "'$AMPLITUDE_API_KEY'",
    "events": [
      {"user_id": "user1", "event_type": "Page View"},
      {"user_id": "user2", "event_type": "Page View"}
    ]
  }'
```

## Export Events (Dashboard API)

```bash
curl -u "$AMPLITUDE_API_KEY:$AMPLITUDE_SECRET_KEY" \
  "https://amplitude.com/api/2/export?start=20240101T00&end=20240102T00"
```

## Get User Activity

```bash
curl -u "$AMPLITUDE_API_KEY:$AMPLITUDE_SECRET_KEY" \
  "https://amplitude.com/api/2/useractivity?user=user123"
```

## Get Active Users

```bash
curl -u "$AMPLITUDE_API_KEY:$AMPLITUDE_SECRET_KEY" \
  "https://amplitude.com/api/2/users/list?start=20240101&end=20240131"
```

## Links
- Dashboard: https://analytics.amplitude.com
- Docs: https://www.docs.developers.amplitude.com
