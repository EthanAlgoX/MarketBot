---
name: easyverein-api
description: "Work with the easyVerein v2.0 REST API (members, contacts, events, invoices, bookings, custom fields, etc.). Use for full API coverage: endpoint discovery, auth, request/response schemas, and example cURL calls."
---

# easyVerein API (v2.0)

## Quick start
- Base URL: `https://easyverein.com/api/v2.0`
- Auth header: `Authorization: Bearer <API_KEY>`
- Tokens expire after 30 days; refresh via `GET /api/v2.0/refresh-token` when `tokenRefreshNeeded` appears in response headers.
- Rate limit: **100 requests/min**.

## Use the OpenAPI spec
Read the full spec when you need endpoint details or schemas:
- `references/openapi-v2.json`

This file contains **all endpoints**, parameters, request bodies, responses, and tags. Use it to:
- list endpoints by tag (e.g., `member`, `contact-details`, `invoice`)
- inspect request body schemas
- find actions and sub-endpoints

## Common patterns
- Pagination: `?limit=` (default 5, max 100)
- Field selection: `?query={field,relation{subfield}}`
- Excluding fields: `?query={-field}`
- Bulk operations: `bulk-create` / `bulk-update` (supported by select endpoints)

## Example cURL (template)
```bash
curl -s \
  -H "Authorization: Bearer $EASYVEREIN_TOKEN" \
  -H "Content-Type: application/json" \
  "https://easyverein.com/api/v2.0/member?limit=10"
```

## Member creation flow (important)
1) Create `contact-details` first.
2) Then create `member` with `emailOrUserName` and `contactDetails` reference.

## Notes
- Files must be uploaded via **PATCH** with `Content-Disposition` header.
- Use `refresh-token` to rotate tokens; old token becomes invalid immediately.
