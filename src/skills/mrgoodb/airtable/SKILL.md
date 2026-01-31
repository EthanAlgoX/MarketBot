---
name: airtable
description: Create, read, update, and delete records in Airtable bases. Use when you need to manage data in Airtable spreadsheets/databases, sync data, or automate workflows with Airtable as a data store.
---

# Airtable API

Manage Airtable bases, tables, and records via REST API.

## Setup

1. Get API key: https://airtable.com/create/tokens
2. Create token with scopes: `data.records:read`, `data.records:write`
3. Store token:
```bash
mkdir -p ~/.config/airtable
echo "patXXXXXXXXXXXXXX" > ~/.config/airtable/api_key
```
4. Find Base ID: Open base → Help → API documentation (starts with `app`)

## List Records

```bash
AIRTABLE_KEY=$(cat ~/.config/airtable/api_key)
BASE_ID="appXXXXXXXXXXXXXX"
TABLE_NAME="Table%20Name"  # URL-encoded

curl -s "https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}" \
  -H "Authorization: Bearer ${AIRTABLE_KEY}" | jq '.records'
```

## Get Single Record

```bash
RECORD_ID="recXXXXXXXXXXXXXX"

curl -s "https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}/${RECORD_ID}" \
  -H "Authorization: Bearer ${AIRTABLE_KEY}" | jq
```

## Create Record

```bash
curl -s -X POST "https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}" \
  -H "Authorization: Bearer ${AIRTABLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [{
      "fields": {
        "Name": "New Item",
        "Status": "Todo",
        "Notes": "Created via API"
      }
    }]
  }' | jq
```

## Create Multiple Records

```bash
curl -s -X POST "https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}" \
  -H "Authorization: Bearer ${AIRTABLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {"fields": {"Name": "Item 1", "Status": "Todo"}},
      {"fields": {"Name": "Item 2", "Status": "Done"}}
    ]
  }'
```

Max 10 records per request.

## Update Record

```bash
curl -s -X PATCH "https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}/${RECORD_ID}" \
  -H "Authorization: Bearer ${AIRTABLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "Status": "Done",
      "Notes": "Updated via API"
    }
  }' | jq
```

PATCH = partial update, PUT = replace all fields

## Delete Record

```bash
curl -s -X DELETE "https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}/${RECORD_ID}" \
  -H "Authorization: Bearer ${AIRTABLE_KEY}" | jq
```

## Filter Records

```bash
# filterByFormula parameter (URL-encoded)
FORMULA="Status%3D%27Todo%27"  # Status='Todo'

curl -s "https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}?filterByFormula=${FORMULA}" \
  -H "Authorization: Bearer ${AIRTABLE_KEY}" | jq '.records'
```

Common formulas:
- `{Status}='Done'` - Exact match
- `FIND('keyword', {Notes})` - Contains text
- `{Date} >= TODAY()` - Date comparison
- `AND({Status}='Active', {Priority}='High')` - Multiple conditions

## Sort Records

```bash
curl -s "https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}?sort%5B0%5D%5Bfield%5D=Created&sort%5B0%5D%5Bdirection%5D=desc" \
  -H "Authorization: Bearer ${AIRTABLE_KEY}" | jq '.records'
```

## Pagination

```bash
# First page
RESPONSE=$(curl -s "https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}?pageSize=100" \
  -H "Authorization: Bearer ${AIRTABLE_KEY}")

OFFSET=$(echo $RESPONSE | jq -r '.offset // empty')

# Next page (if offset exists)
if [ -n "$OFFSET" ]; then
  curl -s "https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}?pageSize=100&offset=${OFFSET}" \
    -H "Authorization: Bearer ${AIRTABLE_KEY}"
fi
```

## Select Specific Fields

```bash
curl -s "https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}?fields%5B%5D=Name&fields%5B%5D=Status" \
  -H "Authorization: Bearer ${AIRTABLE_KEY}" | jq '.records'
```

## Field Types

- Text: `"value"`
- Number: `123`
- Checkbox: `true` / `false`
- Date: `"2024-01-15"`
- Single Select: `"Option Name"`
- Multi Select: `["Option 1", "Option 2"]`
- Linked Record: `["recXXX", "recYYY"]`
- Attachment: `[{"url": "https://..."}]`

## Rate Limits

- 5 requests per second per base
- Use batch operations (10 records max) to reduce calls
