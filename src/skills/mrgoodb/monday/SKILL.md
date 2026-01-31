---
name: monday
description: Manage monday.com boards, items, and workflows via GraphQL API. Create tasks, update statuses, and automate work.
metadata: {"clawdbot":{"emoji":"📋","requires":{"env":["MONDAY_API_TOKEN"]}}}
---

# Monday.com

Work management platform.

## Environment

```bash
export MONDAY_API_TOKEN="xxxxxxxxxx"
```

## List Boards

```bash
curl "https://api.monday.com/v2" \
  -H "Authorization: $MONDAY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ boards(limit:10) { id name } }"}'
```

## Get Board Items

```bash
curl "https://api.monday.com/v2" \
  -H "Authorization: $MONDAY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ boards(ids: [BOARD_ID]) { items_page { items { id name column_values { id text } } } } }"}'
```

## Create Item

```bash
curl "https://api.monday.com/v2" \
  -H "Authorization: $MONDAY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { create_item(board_id: BOARD_ID, item_name: \"New Task\") { id } }"}'
```

## Update Item Column

```bash
curl "https://api.monday.com/v2" \
  -H "Authorization: $MONDAY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { change_column_value(board_id: BOARD_ID, item_id: ITEM_ID, column_id: \"status\", value: \"{\\\"label\\\":\\\"Done\\\"}\") { id } }"}'
```

## Add Update (Comment)

```bash
curl "https://api.monday.com/v2" \
  -H "Authorization: $MONDAY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "mutation { create_update(item_id: ITEM_ID, body: \"Task completed!\") { id } }"}'
```

## Get User Info

```bash
curl "https://api.monday.com/v2" \
  -H "Authorization: $MONDAY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "{ me { id name email } }"}'
```

## Links
- Dashboard: https://monday.com
- Docs: https://developer.monday.com/api-reference
