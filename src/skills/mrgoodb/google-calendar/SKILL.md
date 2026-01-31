---
name: google-calendar
description: Manage Google Calendar events - create, list, update, and delete events. Use when you need to check schedules, create meetings, or automate calendar management. Requires OAuth2 setup.
---

# Google Calendar API

Manage calendar events via Google Calendar API.

## Setup (OAuth2)

1. Create project: https://console.cloud.google.com
2. Enable Calendar API: APIs & Services → Enable APIs → Google Calendar API
3. Create OAuth credentials: APIs & Services → Credentials → Create OAuth Client ID
4. Download JSON → save as `~/.config/google/credentials.json`
5. Get refresh token using oauth2 flow (see below)

## Quick Auth (using gcalcli)

Easiest setup using gcalcli:
```bash
pip install gcalcli
gcalcli init  # Opens browser for OAuth
```

Or use gcloud:
```bash
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/calendar
```

## API Basics

```bash
ACCESS_TOKEN=$(gcloud auth application-default print-access-token)

curl -s "https://www.googleapis.com/calendar/v3/users/me/calendarList" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq '.items[] | {id, summary}'
```

## List Calendars

```bash
curl -s "https://www.googleapis.com/calendar/v3/users/me/calendarList" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq '.items[] | {id, summary}'
```

Primary calendar ID is usually your email or `primary`.

## List Events

```bash
CALENDAR_ID="primary"
TIME_MIN=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TIME_MAX=$(date -u -d "+7 days" +"%Y-%m-%dT%H:%M:%SZ")

curl -s "https://www.googleapis.com/calendar/v3/calendars/${CALENDAR_ID}/events?timeMin=${TIME_MIN}&timeMax=${TIME_MAX}&singleEvents=true&orderBy=startTime" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq '.items[] | {summary, start: .start.dateTime, end: .end.dateTime}'
```

## Get Today's Events

```bash
TODAY=$(date -u +"%Y-%m-%dT00:00:00Z")
TOMORROW=$(date -u -d "+1 day" +"%Y-%m-%dT00:00:00Z")

curl -s "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${TODAY}&timeMax=${TOMORROW}&singleEvents=true&orderBy=startTime" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq '.items[] | {summary, start: .start.dateTime}'
```

## Create Event

```bash
curl -s -X POST "https://www.googleapis.com/calendar/v3/calendars/primary/events" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Meeting Title",
    "description": "Meeting description",
    "start": {
      "dateTime": "2024-01-15T10:00:00",
      "timeZone": "Europe/Paris"
    },
    "end": {
      "dateTime": "2024-01-15T11:00:00",
      "timeZone": "Europe/Paris"
    }
  }' | jq '{id, summary, htmlLink}'
```

## Create Event with Attendees

```bash
curl -s -X POST "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Team Meeting",
    "start": {"dateTime": "2024-01-15T14:00:00", "timeZone": "Europe/Paris"},
    "end": {"dateTime": "2024-01-15T15:00:00", "timeZone": "Europe/Paris"},
    "attendees": [
      {"email": "person1@example.com"},
      {"email": "person2@example.com"}
    ],
    "conferenceData": {
      "createRequest": {"requestId": "meet-'$(date +%s)'"}
    }
  }' | jq
```

Add `sendUpdates=all` to send email invites.

## Create All-Day Event

```bash
curl -s -X POST "https://www.googleapis.com/calendar/v3/calendars/primary/events" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Holiday",
    "start": {"date": "2024-01-15"},
    "end": {"date": "2024-01-16"}
  }'
```

Use `date` (not `dateTime`) for all-day events.

## Update Event

```bash
EVENT_ID="event_id_here"

curl -s -X PATCH "https://www.googleapis.com/calendar/v3/calendars/primary/events/${EVENT_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Updated Title",
    "description": "Updated description"
  }'
```

## Delete Event

```bash
curl -s -X DELETE "https://www.googleapis.com/calendar/v3/calendars/primary/events/${EVENT_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

## Add Google Meet

```bash
curl -s -X POST "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Video Call",
    "start": {"dateTime": "2024-01-15T10:00:00", "timeZone": "Europe/Paris"},
    "end": {"dateTime": "2024-01-15T11:00:00", "timeZone": "Europe/Paris"},
    "conferenceData": {
      "createRequest": {
        "requestId": "'$(uuidgen)'",
        "conferenceSolutionKey": {"type": "hangoutsMeet"}
      }
    }
  }' | jq '.conferenceData.entryPoints[0].uri'
```

## Free/Busy Query

```bash
curl -s -X POST "https://www.googleapis.com/calendar/v3/freeBusy" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "timeMin": "2024-01-15T00:00:00Z",
    "timeMax": "2024-01-15T23:59:59Z",
    "items": [{"id": "primary"}]
  }' | jq '.calendars.primary.busy'
```

## Quick Add (Natural Language)

```bash
curl -s -X POST "https://www.googleapis.com/calendar/v3/calendars/primary/events/quickAdd?text=Lunch%20with%20John%20tomorrow%20at%20noon" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" | jq
```

## Rate Limits

- 1,000,000 queries/day (default)
- 100 requests/100 seconds/user
