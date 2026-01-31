---
name: typeform
description: Create and manage forms, surveys, and quizzes via Typeform API. Retrieve responses and analytics.
metadata: {"clawdbot":{"emoji":"📝","requires":{"env":["TYPEFORM_API_TOKEN"]}}}
---

# Typeform

Forms and surveys.

## Environment

```bash
export TYPEFORM_API_TOKEN="tfp_xxxxxxxxxx"
```

## List Forms

```bash
curl "https://api.typeform.com/forms" \
  -H "Authorization: Bearer $TYPEFORM_API_TOKEN"
```

## Get Form Details

```bash
curl "https://api.typeform.com/forms/{form_id}" \
  -H "Authorization: Bearer $TYPEFORM_API_TOKEN"
```

## Get Responses

```bash
curl "https://api.typeform.com/forms/{form_id}/responses" \
  -H "Authorization: Bearer $TYPEFORM_API_TOKEN"
```

## Get Response Count

```bash
curl "https://api.typeform.com/forms/{form_id}/responses?page_size=1" \
  -H "Authorization: Bearer $TYPEFORM_API_TOKEN" | jq '.total_items'
```

## Create Form

```bash
curl -X POST "https://api.typeform.com/forms" \
  -H "Authorization: Bearer $TYPEFORM_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Feedback Survey",
    "fields": [
      {"type": "short_text", "title": "What is your name?"},
      {"type": "rating", "title": "How would you rate us?", "properties": {"steps": 5}}
    ]
  }'
```

## Delete Response

```bash
curl -X DELETE "https://api.typeform.com/forms/{form_id}/responses?included_response_ids={response_id}" \
  -H "Authorization: Bearer $TYPEFORM_API_TOKEN"
```

## Links
- Dashboard: https://admin.typeform.com
- Docs: https://developer.typeform.com
