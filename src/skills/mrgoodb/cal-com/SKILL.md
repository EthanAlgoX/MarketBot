---
name: cal-com
description: Manage Cal.com scheduling - list bookings, event types, and availability. Use when you need to check schedules, manage booking links, or automate meeting scheduling with Cal.com's API.
---

# Cal.com API

Manage scheduling and bookings via Cal.com API.

## Setup

1. Get API key: Cal.com → Settings → Developer → API Keys
2. Store key:
```bash
mkdir -p ~/.config/calcom
echo "cal_live_XXXXX" > ~/.config/calcom/api_key
```

## API Basics

```bash
CAL_KEY=$(cat ~/.config/calcom/api_key)
CAL_URL="https://api.cal.com/v1"  # or self-hosted URL

curl -s "${CAL_URL}/me?apiKey=${CAL_KEY}" | jq
```

## List Event Types

```bash
curl -s "${CAL_URL}/event-types?apiKey=${CAL_KEY}" | jq '.event_types[] | {id, title, slug, length}'
```

## Get Event Type

```bash
EVENT_TYPE_ID="123"

curl -s "${CAL_URL}/event-types/${EVENT_TYPE_ID}?apiKey=${CAL_KEY}" | jq
```

## List Bookings

```bash
curl -s "${CAL_URL}/bookings?apiKey=${CAL_KEY}" | jq '.bookings[] | {id, title, startTime, endTime, status}'
```

## Get Booking

```bash
BOOKING_ID="123"

curl -s "${CAL_URL}/bookings/${BOOKING_ID}?apiKey=${CAL_KEY}" | jq
```

## Filter Bookings by Status

```bash
# upcoming, past, cancelled, recurring
curl -s "${CAL_URL}/bookings?apiKey=${CAL_KEY}&status=upcoming" | jq '.bookings'
```

## Create Booking

```bash
curl -s -X POST "${CAL_URL}/bookings?apiKey=${CAL_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventTypeId": 123,
    "start": "2024-01-15T10:00:00.000Z",
    "end": "2024-01-15T10:30:00.000Z",
    "responses": {
      "name": "John Doe",
      "email": "john@example.com",
      "notes": "Looking forward to our meeting"
    },
    "timeZone": "Europe/Paris",
    "language": "en"
  }' | jq
```

## Cancel Booking

```bash
curl -s -X DELETE "${CAL_URL}/bookings/${BOOKING_ID}?apiKey=${CAL_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"cancellationReason": "Schedule conflict"}' | jq
```

## Reschedule Booking

```bash
curl -s -X PATCH "${CAL_URL}/bookings/${BOOKING_ID}?apiKey=${CAL_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "start": "2024-01-16T14:00:00.000Z",
    "end": "2024-01-16T14:30:00.000Z"
  }' | jq
```

## List Availabilities

```bash
curl -s "${CAL_URL}/availability?apiKey=${CAL_KEY}&eventTypeId=123&dateFrom=2024-01-15&dateTo=2024-01-22" | jq
```

## Get Available Slots

```bash
curl -s "${CAL_URL}/slots?apiKey=${CAL_KEY}&eventTypeId=123&startTime=2024-01-15&endTime=2024-01-22&timeZone=Europe/Paris" | jq '.slots'
```

## List Schedules

```bash
curl -s "${CAL_URL}/schedules?apiKey=${CAL_KEY}" | jq '.schedules[] | {id, name, timeZone}'
```

## Webhooks

List:
```bash
curl -s "${CAL_URL}/webhooks?apiKey=${CAL_KEY}" | jq
```

Create:
```bash
curl -s -X POST "${CAL_URL}/webhooks?apiKey=${CAL_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriberUrl": "https://example.com/webhook",
    "eventTriggers": ["BOOKING_CREATED", "BOOKING_CANCELLED"],
    "active": true
  }' | jq
```

## Event Triggers

- `BOOKING_CREATED`
- `BOOKING_CANCELLED`
- `BOOKING_RESCHEDULED`
- `BOOKING_CONFIRMED`
- `BOOKING_REJECTED`

## Self-Hosted

For self-hosted Cal.com, change base URL:
```bash
CAL_URL="https://your-cal-instance.com/api/v1"
```

## Rate Limits

- Default: No published limits (be reasonable)
- Self-hosted: Depends on your infrastructure
