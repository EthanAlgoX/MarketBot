---
name: mixpanel
description: Track events and analyze user behavior via Mixpanel API. Query analytics, manage user profiles, and export data.
metadata: {"clawdbot":{"emoji":"📊","requires":{"env":["MIXPANEL_TOKEN","MIXPANEL_API_SECRET"]}}}
---

# Mixpanel

Product analytics.

## Environment

```bash
export MIXPANEL_TOKEN="xxxxxxxxxx"          # Project token (tracking)
export MIXPANEL_API_SECRET="xxxxxxxxxx"     # API secret (querying)
export MIXPANEL_PROJECT_ID="123456"
```

## Track Event

```bash
curl "https://api.mixpanel.com/track" \
  -d "data=$(echo -n '{"event":"Button Clicked","properties":{"distinct_id":"user123","token":"'$MIXPANEL_TOKEN'"}}' | base64)"
```

## Track Event (JSON)

```bash
curl -X POST "https://api.mixpanel.com/import?strict=1" \
  -u "$MIXPANEL_API_SECRET:" \
  -H "Content-Type: application/json" \
  -d '[{"event":"Purchase","properties":{"distinct_id":"user123","time":'$(date +%s)',"price":29.99}}]'
```

## Query Events (JQL)

```bash
curl "https://mixpanel.com/api/2.0/jql" \
  -u "$MIXPANEL_API_SECRET:" \
  -d 'script=function main(){return Events({from_date:"2024-01-01",to_date:"2024-01-31"}).groupBy(["name"],mixpanel.reducer.count())}'
```

## Get User Profile

```bash
curl "https://mixpanel.com/api/2.0/engage?distinct_id=user123" \
  -u "$MIXPANEL_API_SECRET:"
```

## Update User Profile

```bash
curl "https://api.mixpanel.com/engage#profile-set" \
  -d "data=$(echo -n '{"$token":"'$MIXPANEL_TOKEN'","$distinct_id":"user123","$set":{"plan":"premium"}}' | base64)"
```

## Links
- Dashboard: https://mixpanel.com
- Docs: https://developer.mixpanel.com
