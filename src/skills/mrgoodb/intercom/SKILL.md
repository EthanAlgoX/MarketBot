---
name: intercom
description: Manage customer conversations, contacts, and help articles via Intercom API. Send messages and manage support inbox.
metadata: {"clawdbot":{"emoji":"💬","requires":{"env":["INTERCOM_ACCESS_TOKEN"]}}}
---

# Intercom

Customer messaging platform.

## Environment

```bash
export INTERCOM_ACCESS_TOKEN="dG9rOxxxxxxxxxx"
```

## List Contacts

```bash
curl "https://api.intercom.io/contacts" \
  -H "Authorization: Bearer $INTERCOM_ACCESS_TOKEN" \
  -H "Accept: application/json"
```

## Search Contacts

```bash
curl -X POST "https://api.intercom.io/contacts/search" \
  -H "Authorization: Bearer $INTERCOM_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": {"field": "email", "operator": "=", "value": "user@example.com"}}'
```

## Create Contact

```bash
curl -X POST "https://api.intercom.io/contacts" \
  -H "Authorization: Bearer $INTERCOM_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "user", "email": "user@example.com", "name": "John Doe"}'
```

## Send Message

```bash
curl -X POST "https://api.intercom.io/messages" \
  -H "Authorization: Bearer $INTERCOM_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message_type": "inapp",
    "body": "Hey! How can I help?",
    "from": {"type": "admin", "id": "ADMIN_ID"},
    "to": {"type": "user", "id": "USER_ID"}
  }'
```

## List Conversations

```bash
curl "https://api.intercom.io/conversations" \
  -H "Authorization: Bearer $INTERCOM_ACCESS_TOKEN"
```

## Reply to Conversation

```bash
curl -X POST "https://api.intercom.io/conversations/{id}/reply" \
  -H "Authorization: Bearer $INTERCOM_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message_type": "comment", "type": "admin", "admin_id": "ADMIN_ID", "body": "Thanks for reaching out!"}'
```

## Links
- Dashboard: https://app.intercom.com
- Docs: https://developers.intercom.com
