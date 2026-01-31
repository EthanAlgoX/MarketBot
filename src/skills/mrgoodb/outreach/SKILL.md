---
name: outreach
description: Manage sales engagement via Outreach API. Create sequences, manage prospects, and track activities.
metadata: {"clawdbot":{"emoji":"📧","requires":{"env":["OUTREACH_ACCESS_TOKEN"]}}}
---
# Outreach
Sales engagement platform.
## Environment
```bash
export OUTREACH_ACCESS_TOKEN="xxxxxxxxxx"
```
## List Prospects
```bash
curl "https://api.outreach.io/api/v2/prospects" \
  -H "Authorization: Bearer $OUTREACH_ACCESS_TOKEN" \
  -H "Content-Type: application/vnd.api+json"
```
## Create Prospect
```bash
curl -X POST "https://api.outreach.io/api/v2/prospects" \
  -H "Authorization: Bearer $OUTREACH_ACCESS_TOKEN" \
  -H "Content-Type: application/vnd.api+json" \
  -d '{"data": {"type": "prospect", "attributes": {"firstName": "John", "lastName": "Doe", "emails": ["john@example.com"]}}}'
```
## List Sequences
```bash
curl "https://api.outreach.io/api/v2/sequences" \
  -H "Authorization: Bearer $OUTREACH_ACCESS_TOKEN"
```
## Add to Sequence
```bash
curl -X POST "https://api.outreach.io/api/v2/sequenceStates" \
  -H "Authorization: Bearer $OUTREACH_ACCESS_TOKEN" \
  -H "Content-Type: application/vnd.api+json" \
  -d '{"data": {"type": "sequenceState", "relationships": {"prospect": {"data": {"type": "prospect", "id": "123"}}, "sequence": {"data": {"type": "sequence", "id": "456"}}}}}'
```
## Links
- Dashboard: https://app.outreach.io
- Docs: https://api.outreach.io/api/v2/docs
