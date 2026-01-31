---
name: blinko
description: Manage Blinko notes via its REST API (create/list/delete notes, manage tags/taxonomy). Use when the user says “blinko …”, wants to capture a note to Blinko, list/search recent notes, retag notes, or do cleanup/organization. Requires BLINKO_API_KEY.
---

# Blinko

Use Blinko as the single source of truth for notes.

## Setup (one-time)

Env vars (Gateway env is OK):
- `BLINKO_API_KEY` (required)
- `BLINKO_BASE_URL` (optional; default `https://blinko.exemple.com`)

## Core workflow

### 1) Create a note
When user says something like:
- “blinko: …”
- “note: …”

Create a note with:
- Markdown body
- Add tags as hashtags at the end (respect the user’s taxonomy constraints)

### 2) List/search notes
If the user asks “liste mes notes” or “cherche …”, call the list endpoint and show:
- id
- first line/title
- top tags (if present)

### 3) Tagging rules (user constraints)
- Max **7** top-level tags.
- For each note: choose **1** top-level tag + **0–2** sub-tags max.
- Sub-tag syntax: `#Tech/dev`.

### 4) Destructive actions (delete/purge)
Always confirm explicitly ("OK vas-y") before:
- deleting notes
- deleting tags

Use the helper script for batch operations.

## Helper script

`scripts/blinko.py` wraps the API.

Examples:
```bash
# list
BLINKO_API_KEY=... ./scripts/blinko.py list --page 1 --size 20

# create
BLINKO_API_KEY=... ./scripts/blinko.py create --title "Test" --content "Hello" --tags "#Inbox #Todo/à-faire"

# delete (destructive)
BLINKO_API_KEY=... ./scripts/blinko.py delete --yes 123 124
```

## Reference

See `references/blinko_api.md` for endpoint cheat sheet.


## Github

https://github.com/Vellis59/openclaw-skill-blinko