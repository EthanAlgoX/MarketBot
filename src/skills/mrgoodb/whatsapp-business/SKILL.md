---
name: whatsapp-business
description: Send messages via WhatsApp Business Cloud API. Send templates, media, and interactive messages to customers.
metadata: {"clawdbot":{"emoji":"💬","requires":{"env":["WHATSAPP_TOKEN","WHATSAPP_PHONE_ID"]}}}
---

# WhatsApp Business Cloud API

Business messaging on WhatsApp.

## Environment

```bash
export WHATSAPP_TOKEN="xxxxxxxxxx"
export WHATSAPP_PHONE_ID="xxxxxxxxxx"
```

## Send Text Message

```bash
curl -X POST "https://graph.facebook.com/v18.0/$WHATSAPP_PHONE_ID/messages" \
  -H "Authorization: Bearer $WHATSAPP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "1234567890",
    "type": "text",
    "text": {"body": "Hello from WhatsApp Business!"}
  }'
```

## Send Template Message

```bash
curl -X POST "https://graph.facebook.com/v18.0/$WHATSAPP_PHONE_ID/messages" \
  -H "Authorization: Bearer $WHATSAPP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "1234567890",
    "type": "template",
    "template": {
      "name": "hello_world",
      "language": {"code": "en_US"}
    }
  }'
```

## Send Image

```bash
curl -X POST "https://graph.facebook.com/v18.0/$WHATSAPP_PHONE_ID/messages" \
  -H "Authorization: Bearer $WHATSAPP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "1234567890",
    "type": "image",
    "image": {"link": "https://example.com/image.jpg"}
  }'
```

## Send Interactive Buttons

```bash
curl -X POST "https://graph.facebook.com/v18.0/$WHATSAPP_PHONE_ID/messages" \
  -H "Authorization: Bearer $WHATSAPP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "1234567890",
    "type": "interactive",
    "interactive": {
      "type": "button",
      "body": {"text": "Choose an option:"},
      "action": {
        "buttons": [
          {"type": "reply", "reply": {"id": "yes", "title": "Yes"}},
          {"type": "reply", "reply": {"id": "no", "title": "No"}}
        ]
      }
    }
  }'
```

## Get Message Templates

```bash
curl "https://graph.facebook.com/v18.0/{WABA_ID}/message_templates" \
  -H "Authorization: Bearer $WHATSAPP_TOKEN"
```

## Links
- Console: https://business.facebook.com/wa/manage/home
- Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
