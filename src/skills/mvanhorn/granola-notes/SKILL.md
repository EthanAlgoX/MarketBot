---
name: granola
description: Access Granola AI meeting notes - CSV import, shared note fetching, and MCP-ready for upcoming API support.
homepage: https://granola.ai
metadata: {"clawdbot":{"emoji":"🥣","requires":{}}}
---

# Granola

Access your [Granola](https://granola.ai) meeting notes. Granola is the AI notepad for people in back-to-back meetings.

## Current Capabilities

### 1. CSV Export Import
Granola allows exporting historical notes as CSV. This skill can parse and search those exports.

```bash
# Parse a Granola CSV export
python3 {baseDir}/scripts/csv_import.py --file ~/Downloads/granola_export.csv

# Search parsed notes
python3 {baseDir}/scripts/csv_import.py --file ~/Downloads/granola_export.csv --search "quarterly review"
```

### 2. Shared Note Fetching
When you share a Granola note, it gets a public URL. This skill can fetch and parse shared notes.

```bash
# Fetch a shared note
python3 {baseDir}/scripts/fetch_shared.py --url "https://share.granola.ai/..."
```

### 3. MCP Integration (Coming Soon)
Granola is building official MCP (Model Context Protocol) support for AI agent access. When available:

```json
{
  "mcpServers": {
    "granola": {
      "command": "granola-mcp",
      "args": ["--api-key", "YOUR_KEY"]
    }
  }
}
```

## How to Export from Granola

1. Open Granola app
2. Go to **Settings → Profile**
3. Click **Generate CSV**
4. CSV will be emailed to you (takes a few hours)

Note: CSV export only includes notes older than 30 days and doesn't include full transcripts.

## Usage Examples

**Import and search meeting notes:**
```
"Search my Granola notes for anything about the product roadmap"
"What did we discuss in last month's board meeting?"
"Find action items from my 1:1s"
```

**When MCP is available:**
```
"What meetings did I have this week?"
"Summarize my meeting with John yesterday"
"What are my action items from today?"
```

## Roadmap

- [x] CSV export parsing
- [x] Shared note fetching
- [ ] MCP integration (waiting for Granola to ship)
- [ ] Full API access (when available)

## Links

- [Granola Help Center](https://help.granola.ai)
- [Export docs](https://help.granola.ai/article/exporting-notes)
- [Granola website](https://granola.ai)
