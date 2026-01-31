# Best Practices (SendGrid)

## Required

- **Verified sender/domain**: Ensure `from` uses a verified sender identity.
- **Use both text + HTML**: Improves deliverability and accessibility.
- **Handle errors correctly**:
  - **400/401/403/422**: Fix request or credentials; do not retry.
  - **429**: Rate limit; retry with exponential backoff.
  - **5xx**: Retry with exponential backoff.

## Attachments

- Base64-encode content.
- Include `type` (MIME) when known.
- Keep payload sizes reasonable; avoid large attachments unless necessary.

## Idempotency

SendGrid doesn’t support idempotency keys for Mail Send. If you need idempotency:
- Track your own message IDs and ensure you don’t send duplicates on retry.
- Persist send attempts and outcomes in your DB.

## Testing

- Avoid fake addresses at real providers (bounces hurt reputation).
- Prefer sending to addresses you control (e.g., `vince@winkintel.com`).
