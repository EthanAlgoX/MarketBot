---
name: postmark
description: Send transactional emails with high deliverability via Postmark API. Manage templates, track bounces, and view analytics.
metadata: {"clawdbot":{"emoji":"📮","requires":{"env":["POSTMARK_SERVER_TOKEN"]}}}
---

# Postmark

Transactional email delivery.

## Environment

```bash
export POSTMARK_SERVER_TOKEN="xxxxxxxxxx"
```

## Send Email

```bash
curl -X POST "https://api.postmarkapp.com/email" \
  -H "X-Postmark-Server-Token: $POSTMARK_SERVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "sender@example.com",
    "To": "recipient@example.com",
    "Subject": "Hello",
    "TextBody": "Hello from Postmark!",
    "HtmlBody": "<p>Hello from Postmark!</p>"
  }'
```

## Send with Template

```bash
curl -X POST "https://api.postmarkapp.com/email/withTemplate" \
  -H "X-Postmark-Server-Token: $POSTMARK_SERVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "From": "sender@example.com",
    "To": "recipient@example.com",
    "TemplateId": 12345,
    "TemplateModel": {"name": "John", "product": "Widget"}
  }'
```

## Send Batch

```bash
curl -X POST "https://api.postmarkapp.com/email/batch" \
  -H "X-Postmark-Server-Token: $POSTMARK_SERVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[
    {"From": "sender@example.com", "To": "user1@example.com", "Subject": "Hi", "TextBody": "Hello 1"},
    {"From": "sender@example.com", "To": "user2@example.com", "Subject": "Hi", "TextBody": "Hello 2"}
  ]'
```

## List Templates

```bash
curl "https://api.postmarkapp.com/templates" \
  -H "X-Postmark-Server-Token: $POSTMARK_SERVER_TOKEN"
```

## Get Bounce Stats

```bash
curl "https://api.postmarkapp.com/bounces" \
  -H "X-Postmark-Server-Token: $POSTMARK_SERVER_TOKEN"
```

## Get Delivery Stats

```bash
curl "https://api.postmarkapp.com/deliverystats" \
  -H "X-Postmark-Server-Token: $POSTMARK_SERVER_TOKEN"
```

## Links
- Dashboard: https://account.postmarkapp.com
- Docs: https://postmarkapp.com/developer
