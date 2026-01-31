---
name: telegram
description: Send messages, photos, and files via Telegram Bot API. Use when you need to send notifications, alerts, or content to Telegram chats, channels, or groups. Supports text formatting, media, and inline keyboards.
---

# Telegram Bot API

Send messages to Telegram using a bot token.

## Setup

1. Create bot via @BotFather on Telegram
2. Copy the bot token
3. Store token:
```bash
mkdir -p ~/.config/telegram
echo "YOUR_BOT_TOKEN" > ~/.config/telegram/bot_token
```
4. Get chat ID: Send `/start` to your bot, then visit:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`

## Send Text Message

```bash
TOKEN=$(cat ~/.config/telegram/bot_token)
CHAT_ID="123456789"

curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\": \"${CHAT_ID}\", \"text\": \"Hello from Clawdbot!\"}"
```

## Formatting (MarkdownV2)

```bash
curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "'$CHAT_ID'",
    "text": "*Bold* _italic_ `code` [link](https://example.com)",
    "parse_mode": "MarkdownV2"
  }'
```

Escape these chars in MarkdownV2: `_*[]()~>#+-=|{}.!`

## Send Photo

```bash
# From URL
curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendPhoto" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "'$CHAT_ID'",
    "photo": "https://example.com/image.jpg",
    "caption": "Image caption"
  }'

# From file
curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendPhoto" \
  -F "chat_id=${CHAT_ID}" \
  -F "photo=@/path/to/image.jpg" \
  -F "caption=Image caption"
```

## Send Document

```bash
curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendDocument" \
  -F "chat_id=${CHAT_ID}" \
  -F "document=@/path/to/file.pdf" \
  -F "caption=File description"
```

## Inline Keyboard (Buttons)

```bash
curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "'$CHAT_ID'",
    "text": "Choose an option:",
    "reply_markup": {
      "inline_keyboard": [[
        {"text": "Option A", "callback_data": "option_a"},
        {"text": "Option B", "callback_data": "option_b"}
      ]]
    }
  }'
```

## Silent Message

```bash
curl -s -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "'$CHAT_ID'",
    "text": "Silent notification",
    "disable_notification": true
  }'
```

## Get Updates (Polling)

```bash
curl -s "https://api.telegram.org/bot${TOKEN}/getUpdates" | jq
```

## Error Handling

Check `ok` field in response:
```json
{"ok": true, "result": {...}}
{"ok": false, "error_code": 400, "description": "Bad Request: chat not found"}
```

## Common Chat IDs

- User chat: Positive number (e.g., `123456789`)
- Group: Negative number (e.g., `-123456789`)
- Channel: `@channel_username` or negative ID

## Rate Limits

- 30 messages/second to same chat
- 20 messages/minute to same group
- Bulk: 30 messages/second across all chats
