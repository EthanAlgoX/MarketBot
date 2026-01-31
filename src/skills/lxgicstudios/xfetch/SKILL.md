---
name: xfetch
description: Fast X/Twitter CLI scraper. Use when you need to fetch tweets, user profiles, search results, timelines, followers, or any X/Twitter data. No API keys required - uses cookie-based auth.
metadata: {"clawdbot":{"emoji":"🐦","requires":{"bins":["xfetch"]},"install":[{"id":"npm","kind":"node","package":"xfetch-cli","bins":["xfetch"],"label":"Install xfetch (npm)"}]}}
---

# xfetch 🐦

Fast X/Twitter CLI scraper. No API keys. Just cookies and go.

## Install

```bash
npm install -g xfetch-cli
```

## Authentication

xfetch requires Twitter session cookies (`auth_token` and `ct0`).

**Set tokens directly:**
```bash
xfetch auth set --auth-token <token> --ct0 <token>
```

**Check auth status:**
```bash
xfetch auth check
```

**Get cookies from browser:** Open X.com in Chrome DevTools → Application → Cookies → Copy `auth_token` and `ct0` values.

## Commands

### User Data
```bash
xfetch user @handle              # Profile by handle
xfetch user 12345678             # Profile by ID
xfetch followers @handle -n 100  # Followers list
xfetch following @handle -n 100  # Following list
```

### Tweets
```bash
xfetch tweets @handle -n 50      # User timeline
xfetch tweet <url-or-id>         # Single tweet
xfetch thread <url-or-id>        # Full conversation thread
```

### Search
```bash
xfetch search "query" -n 100
xfetch search "from:handle since:2024-01-01"
xfetch search "query" --type latest   # top|latest|people|photos|videos
```

### Timelines
```bash
xfetch home                      # Algorithmic home
xfetch home --following          # Chronological
xfetch bookmarks -n 50           # Your bookmarks
xfetch likes @handle -n 50       # User's likes
```

## Output Formats

```bash
xfetch tweets @handle --format json   # Default, pretty
xfetch tweets @handle --format jsonl  # Line-delimited JSON
xfetch tweets @handle --json          # Shorthand for JSON
xfetch tweets @handle --plain         # No formatting
```

## Pagination

```bash
xfetch tweets @handle --all              # All pages
xfetch tweets @handle --max-pages 10     # Limit pages
xfetch tweets @handle --cursor <cursor>  # Resume from cursor
xfetch tweets @handle --delay 1000       # Delay between pages (ms)
```

## Query ID Management

Twitter changes GraphQL query IDs frequently. xfetch auto-refreshes them.

```bash
xfetch query-ids --list      # Show cached IDs
xfetch query-ids --refresh   # Fetch latest from X
```

## Global Options

```bash
--auth-token <token>   # Set auth_token directly
--ct0 <token>          # Set ct0 directly  
--format <format>      # json|jsonl|csv|sqlite
--timeout <ms>         # Request timeout (default: 30000)
--delay <ms>           # Delay between requests (default: 500)
--proxy <url>          # Proxy URL
```

## Examples

**Get recent tweets from a user:**
```bash
xfetch tweets @elonmusk -n 20 --format jsonl
```

**Search for AI content:**
```bash
xfetch search "AI agents" --type latest -n 50
```

**Get thread/conversation:**
```bash
xfetch thread https://x.com/user/status/123456789
```

**Export followers to JSON:**
```bash
xfetch followers @handle --all > followers.json
```

## Rate Limits

xfetch tracks rate limits per endpoint and automatically backs off when approaching limits. For high-volume scraping, use `--delay` to add time between requests.

## Source

GitHub: https://github.com/LXGIC-Studios/xfetch
