---
name: zendesk
description: Manage support tickets, users, and help center via Zendesk API. Create, update, and search tickets programmatically.
metadata: {"clawdbot":{"emoji":"🎫","requires":{"env":["ZENDESK_SUBDOMAIN","ZENDESK_EMAIL","ZENDESK_API_TOKEN"]}}}
---

# Zendesk

Customer support ticket management.

## Environment

```bash
export ZENDESK_SUBDOMAIN="yourcompany"
export ZENDESK_EMAIL="admin@company.com"
export ZENDESK_API_TOKEN="xxxxxxxxxx"
```

## List Tickets

```bash
curl "https://$ZENDESK_SUBDOMAIN.zendesk.com/api/v2/tickets.json" \
  -u "$ZENDESK_EMAIL/token:$ZENDESK_API_TOKEN"
```

## Create Ticket

```bash
curl -X POST "https://$ZENDESK_SUBDOMAIN.zendesk.com/api/v2/tickets.json" \
  -u "$ZENDESK_EMAIL/token:$ZENDESK_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ticket": {
      "subject": "Help needed",
      "comment": {"body": "I need assistance with..."},
      "priority": "normal",
      "requester": {"name": "John", "email": "john@example.com"}
    }
  }'
```

## Update Ticket

```bash
curl -X PUT "https://$ZENDESK_SUBDOMAIN.zendesk.com/api/v2/tickets/{id}.json" \
  -u "$ZENDESK_EMAIL/token:$ZENDESK_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ticket": {"status": "solved", "comment": {"body": "Issue resolved!"}}}'
```

## Search Tickets

```bash
curl "https://$ZENDESK_SUBDOMAIN.zendesk.com/api/v2/search.json?query=status:open" \
  -u "$ZENDESK_EMAIL/token:$ZENDESK_API_TOKEN"
```

## Links
- Admin: https://yourcompany.zendesk.com/admin
- Docs: https://developer.zendesk.com/api-reference
