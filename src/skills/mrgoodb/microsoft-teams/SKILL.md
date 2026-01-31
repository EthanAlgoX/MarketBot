---
name: microsoft-teams
description: Send messages, manage channels, and automate workflows via Microsoft Teams API. Post to channels, create meetings, and manage team memberships.
metadata: {"clawdbot":{"emoji":"👥","requires":{"env":["TEAMS_WEBHOOK_URL"]}}}
---

# Microsoft Teams

Team collaboration and messaging.

## Webhook (Simplest - No Auth)

```bash
# Post to channel via incoming webhook
curl -X POST "$TEAMS_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello from automation!"}'
```

## Adaptive Card via Webhook

```bash
curl -X POST "$TEAMS_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "message",
    "attachments": [{
      "contentType": "application/vnd.microsoft.card.adaptive",
      "content": {
        "type": "AdaptiveCard",
        "body": [{"type": "TextBlock", "text": "Alert!", "weight": "bolder"}],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2"
      }
    }]
  }'
```

## Graph API (Full Access)

Requires Azure AD app registration with Microsoft Graph permissions.

```bash
export TEAMS_ACCESS_TOKEN="xxxxxxxxxx"

# List joined teams
curl "https://graph.microsoft.com/v1.0/me/joinedTeams" \
  -H "Authorization: Bearer $TEAMS_ACCESS_TOKEN"

# List channels
curl "https://graph.microsoft.com/v1.0/teams/{team-id}/channels" \
  -H "Authorization: Bearer $TEAMS_ACCESS_TOKEN"

# Send message to channel
curl -X POST "https://graph.microsoft.com/v1.0/teams/{team-id}/channels/{channel-id}/messages" \
  -H "Authorization: Bearer $TEAMS_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body": {"content": "Hello Teams!"}}'

# Create online meeting
curl -X POST "https://graph.microsoft.com/v1.0/me/onlineMeetings" \
  -H "Authorization: Bearer $TEAMS_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"startDateTime": "2024-01-30T10:00:00Z", "endDateTime": "2024-01-30T11:00:00Z", "subject": "Quick Sync"}'
```

## Links
- Admin: https://admin.teams.microsoft.com
- Docs: https://docs.microsoft.com/en-us/graph/api/resources/teams-api-overview
