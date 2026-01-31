---
name: webflow
description: Manage Webflow sites, CMS collections, and forms via API. Publish sites and manage content programmatically.
metadata: {"clawdbot":{"emoji":"🎨","requires":{"env":["WEBFLOW_API_TOKEN"]}}}
---

# Webflow

Website builder and CMS.

## Environment

```bash
export WEBFLOW_API_TOKEN="xxxxxxxxxx"
```

## List Sites

```bash
curl "https://api.webflow.com/v2/sites" \
  -H "Authorization: Bearer $WEBFLOW_API_TOKEN"
```

## Get Site Details

```bash
curl "https://api.webflow.com/v2/sites/{site_id}" \
  -H "Authorization: Bearer $WEBFLOW_API_TOKEN"
```

## List Collections (CMS)

```bash
curl "https://api.webflow.com/v2/sites/{site_id}/collections" \
  -H "Authorization: Bearer $WEBFLOW_API_TOKEN"
```

## List Collection Items

```bash
curl "https://api.webflow.com/v2/collections/{collection_id}/items" \
  -H "Authorization: Bearer $WEBFLOW_API_TOKEN"
```

## Create CMS Item

```bash
curl -X POST "https://api.webflow.com/v2/collections/{collection_id}/items" \
  -H "Authorization: Bearer $WEBFLOW_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldData": {
      "name": "New Blog Post",
      "slug": "new-blog-post",
      "content": "Post content here..."
    }
  }'
```

## Publish Site

```bash
curl -X POST "https://api.webflow.com/v2/sites/{site_id}/publish" \
  -H "Authorization: Bearer $WEBFLOW_API_TOKEN"
```

## List Form Submissions

```bash
curl "https://api.webflow.com/v2/sites/{site_id}/forms/{form_id}/submissions" \
  -H "Authorization: Bearer $WEBFLOW_API_TOKEN"
```

## Links
- Dashboard: https://webflow.com/dashboard
- Docs: https://developers.webflow.com
