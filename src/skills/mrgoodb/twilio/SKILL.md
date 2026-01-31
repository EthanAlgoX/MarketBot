---
name: twilio
description: Send SMS, make voice calls, and manage WhatsApp messages via Twilio API. Use for notifications, 2FA, customer communications, and voice automation.
metadata: {"clawdbot":{"emoji":"📱","requires":{"env":["TWILIO_ACCOUNT_SID","TWILIO_AUTH_TOKEN"]}}}
---

# Twilio

Send SMS, voice calls, and WhatsApp messages.

## Environment Variables

```bash
export TWILIO_ACCOUNT_SID="ACxxxxxxxxxx"
export TWILIO_AUTH_TOKEN="your_auth_token"
export TWILIO_PHONE_NUMBER="+1234567890"
```

## Send SMS

```bash
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  -d "From=$TWILIO_PHONE_NUMBER" \
  -d "To=+1recipient" \
  -d "Body=Hello from Twilio!"
```

## Send WhatsApp

```bash
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  -d "From=whatsapp:+14155238886" \
  -d "To=whatsapp:+1recipient" \
  -d "Body=Your message"
```

## Make Voice Call

```bash
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Calls.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  -d "From=$TWILIO_PHONE_NUMBER" \
  -d "To=+1recipient" \
  -d "Url=http://demo.twilio.com/docs/voice.xml"
```

## List Messages

```bash
curl "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json?PageSize=20" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"
```

## Check Balance

```bash
curl "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Balance.json" \
  -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"
```

## Links
- Console: https://console.twilio.com
- Docs: https://www.twilio.com/docs
