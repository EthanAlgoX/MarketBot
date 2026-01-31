---
name: sendgrid
description: Send transactional and marketing emails via SendGrid API. Supports templates, attachments, and email analytics.
metadata: {"clawdbot":{"emoji":"📧","requires":{"env":["SENDGRID_API_KEY"]}}}
---

# SendGrid

Send emails at scale.

## Environment

```bash
export SENDGRID_API_KEY="SG.xxxxxxxxxx"
```

## Send Email

```bash
curl -X POST "https://api.sendgrid.com/v3/mail/send" \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "personalizations": [{"to": [{"email": "recipient@example.com"}]}],
    "from": {"email": "sender@example.com"},
    "subject": "Hello",
    "content": [{"type": "text/plain", "value": "Hello World!"}]
  }'
```

## Send with Template

```bash
curl -X POST "https://api.sendgrid.com/v3/mail/send" \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "personalizations": [{
      "to": [{"email": "recipient@example.com"}],
      "dynamic_template_data": {"name": "John", "order_id": "12345"}
    }],
    "from": {"email": "sender@example.com"},
    "template_id": "d-xxxxxxxxxxxx"
  }'
```

## List Templates

```bash
curl "https://api.sendgrid.com/v3/templates?generations=dynamic" \
  -H "Authorization: Bearer $SENDGRID_API_KEY"
```

## Get Email Stats

```bash
curl "https://api.sendgrid.com/v3/stats?start_date=2024-01-01" \
  -H "Authorization: Bearer $SENDGRID_API_KEY"
```

## Links
- Console: https://app.sendgrid.com
- Docs: https://docs.sendgrid.com
