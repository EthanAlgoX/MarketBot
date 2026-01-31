---
name: calendly
description: Manage Calendly scheduling - list events, bookings, and availability. Create scheduling links programmatically.
metadata: {"clawdbot":{"emoji":"📅","requires":{"env":["CALENDLY_API_TOKEN"]}}}
---

# Calendly

Scheduling automation.

## Environment

```bash
export CALENDLY_API_TOKEN="xxxxxxxxxx"
```

## Get Current User

```bash
curl "https://api.calendly.com/users/me" \
  -H "Authorization: Bearer $CALENDLY_API_TOKEN"
```

## List Event Types

```bash
curl "https://api.calendly.com/event_types?user=https://api.calendly.com/users/USERID" \
  -H "Authorization: Bearer $CALENDLY_API_TOKEN"
```

## List Scheduled Events

```bash
curl "https://api.calendly.com/scheduled_events?user=https://api.calendly.com/users/USERID&status=active" \
  -H "Authorization: Bearer $CALENDLY_API_TOKEN"
```

## Get Event Details

```bash
curl "https://api.calendly.com/scheduled_events/{uuid}" \
  -H "Authorization: Bearer $CALENDLY_API_TOKEN"
```

## List Invitees

```bash
curl "https://api.calendly.com/scheduled_events/{event_uuid}/invitees" \
  -H "Authorization: Bearer $CALENDLY_API_TOKEN"
```

## Cancel Event

```bash
curl -X POST "https://api.calendly.com/scheduled_events/{uuid}/cancellation" \
  -H "Authorization: Bearer $CALENDLY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Scheduling conflict"}'
```

## Links
- Dashboard: https://calendly.com/app/home
- Docs: https://developer.calendly.com
