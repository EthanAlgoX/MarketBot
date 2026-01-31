---
name: mailchannels-email-api
description: Send email via MailChannels Email API and ingest signed delivery-event webhooks into Clawdbot (Moltbot).
homepage: https://docs.mailchannels.net/email-api/
metadata: {"moltbot":{"emoji":"📨","requires":{"env":["MAILCHANNELS_API_KEY","MAILCHANNELS_ACCOUNT_ID"],"bins":["curl"]},"primaryEnv":"MAILCHANNELS_API_KEY"}}
---

# MailChannels Email API (Send + Delivery Events)

## Environment

Required:
- `MAILCHANNELS_API_KEY` (send in `X-Api-Key`)
- `MAILCHANNELS_ACCOUNT_ID` (aka `customer_handle`)

Optional:
- `MAILCHANNELS_BASE_URL` (default: `https://api.mailchannels.net/tx/v1`), `MAILCHANNELS_WEBHOOK_ENDPOINT_URL`

## Domain Lockdown (DNS)

Create a TXT record for each sender domain:
- Host: `_mailchannels.<your-domain>`
- Value: `v=mc1; auid=<YOUR_ACCOUNT_ID>`

## API Quick Reference
Base URL: `${MAILCHANNELS_BASE_URL:-https://api.mailchannels.net/tx/v1}`
- Send: `POST /send`
- Send async: `POST /send-async`
- Webhook: `POST /webhook?endpoint=<url>`, `GET /webhook`, `DELETE /webhook`, `POST /webhook/validate`
- Public key: `GET /webhook/public-key?id=<keyid>`

## Sending Email
Minimum payload fields: `personalizations`, `from`, `subject`, `content`.
Use `/send` for normal traffic and `/send-async` for queued/low-latency; both produce webhooks.
Persist MailChannels correlation IDs (e.g., `request_id`).

## Delivery Events (Webhooks)
MailChannels POSTs a JSON array. Common fields: `email`, `customer_handle`, `timestamp`, `event`, `request_id`.
Bounce fields often include: `recipients`, `status`, `reason`, `smtp_id`.

## Moltbot Hooks Routing
1) Enable hooks in `~/.clawdbot/moltbot.json`.
2) Map `/hooks/<path>` to an agent action via `hooks.mappings` and optional transform.
3) Enroll the public endpoint in MailChannels `/webhook?endpoint=...`.

## Webhook Signature Verification
Headers: `Content-Digest`, `Signature-Input`, `Signature`.
Steps:
- Parse `Signature-Input` (name, `created`, `alg`, `keyid`).
- Reject stale `created` values.
- Fetch public key by `keyid`.
- Recreate the RFC 9421 signature base.
- Verify ed25519 signature (avoid hand-rolling).
Also verify JSON body is an array and every event has `customer_handle == MAILCHANNELS_ACCOUNT_ID`.

## Correlation + State Updates
Store your internal message ID + MailChannels IDs (e.g., `request_id`, `smtp_id`).
Update delivery state from events: `processed`, `delivered`, `soft-bounced`, `hard-bounced`, `dropped`.
Operational tips: respond 2xx quickly, process async, store raw events, dedupe retries.
