# MarketBot bb-browser Integration Plan

## Goal

Integrate the strongest capabilities of `bb-browser` into MarketBot without
copying its monorepo or site-adapter implementation.

MarketBot should treat `bb-browser` as a local dependency that provides:

- real-browser login-state access
- site-specific adapters
- browser automation primitives
- optional MCP-compatible browser transport

## Why It Matters

MarketBot already supports:

- API-backed market data
- structured market tools
- skills for analysis and reporting
- multi-channel delivery

What it does not yet support well:

- authenticated browser access to dynamic or anti-bot sites
- site-native search and logged-in user feeds
- browser-network inspection for hard-to-reach finance pages

That is exactly where `bb-browser` fits.

## Design Principles

1. Do not reimplement `bb-browser`.
2. Do not vendor its extension, daemon, or adapters into MarketBot.
3. Wrap the local CLI with strict safety controls.
4. Route browser-backed research through specialist skills, not broad prompts.
5. Keep browser access optional and explicit in config.

## Proposed Tooling

Add a new module:

```text
marketbot/agent/tools/browser.py
```

Register three tools:

### 1. `browser_site`

Purpose:

- invoke site adapters such as Xueqiu, Eastmoney, Yahoo Finance, YouTube,
  Reddit, Zhihu, or GitHub

Suggested interface:

```json
{
  "adapter": "xueqiu/hot-stock",
  "args": ["10"],
  "json": true,
  "jq": ".items[] | {name, changePercent}"
}
```

CLI mapping:

```bash
bb-browser site xueqiu/hot-stock 10 --json --jq '...'
```

### 2. `browser_page`

Purpose:

- generic page interaction

Supported actions:

- `open`
- `snapshot`
- `click`
- `fill`
- `screenshot`
- `eval`

Use cases:

- open a logged-in page
- inspect rendered DOM
- take screenshots for review
- interact with search boxes or tabs

### 3. `browser_network`

Purpose:

- access authenticated network-level data only when explicitly allowed

Supported modes:

- `fetch`
- `requests`

Use cases:

- capture XHR responses from finance sites
- fetch authenticated JSON endpoints from browser context

## Safety Model

This integration is high-trust because it operates with the user's real browser
session.

Add config-level modes:

### `safe`

Allowed:

- `browser_site`
- `browser_page` with `open`, `snapshot`, `screenshot`

Blocked:

- `eval`
- `fill`
- `click`
- `browser_network`

### `interactive`

Allowed:

- all `safe`
- `click`
- `fill`

Blocked:

- `browser_network` by default
- unrestricted `eval`

### `sensitive`

Allowed:

- all actions including `eval`, `fetch`, and network request capture

Requirements:

- explicit user config
- optional allowlist on site adapters
- optional URL allowlist on `browser_page(open)` and `browser_network(fetch)`
- explicit `allowRequestCapture=true` before `browser_network` can inspect requests
- explicit `allowRequestBodies=true` before `browser_network(..., withBody=true)` can capture request bodies
- clear warning in docs

## Configuration

Extend MarketBot config with:

```json
{
  "tools": {
    "browser": {
      "enabled": true,
      "command": "bb-browser",
      "mode": "safe",
      "timeoutS": 20,
      "allowDomains": [
        "xueqiu.com",
        "eastmoney.com",
        "reddit.com",
        "github.com",
        "youtube.com"
      ],
      "allowUrlPrefixes": [
        "https://www.youtube.com/watch?v=",
        "https://api.github.com/repos/"
      ],
      "allowSites": [
        "xueqiu",
        "eastmoney",
        "youtube",
        "reddit",
        "zhihu",
        "github"
      ]
    }
  }
}
```

Recommended production stance:

- keep `mode` at `safe` unless interactive browsing is required
- use `allowSites` and `allowAdapters` to bound `browser_site`
- use `allowDomains` or `allowUrlPrefixes` to bound `browser_page(open)` and `browser_network(fetch)`
- keep `allowRequestCapture` and `allowRequestBodies` off unless request inspection is specifically required

## Skills To Add

### 1. `xueqiu-research`

Purpose:

- read hot stocks, stock pages, feed context, and discussion mood from Xueqiu

Depends on:

- `browser_site`

Primary adapters:

- `xueqiu/hot-stock`
- `xueqiu/stock`
- `xueqiu/feed`

### 2. `eastmoney-live`

Purpose:

- complement A-share market intelligence with Eastmoney site-native pages and
  logged-in content where needed

Depends on:

- `browser_site`

Primary adapters:

- `eastmoney/stock`
- `eastmoney/headlines`

### 3. `social-signal-browser`

Purpose:

- browser-backed sentiment enrichment from Reddit, X, Zhihu, Bilibili, and
  Xiaohongshu

Depends on:

- `browser_site`

### 4. `browser-news-verifier`

Purpose:

- verify or expand a news cluster using site-native search and logged-in page
  context

Depends on:

- `browser_site`
- optional `browser_page`

## Existing Skills To Update

### `stock-data-sourcing`

Add a new source lane:

- `browser-authenticated`

Use this when:

- public APIs fail
- site-native search is materially better
- login-state pages are required

### `news-intelligence`

Add browser-backed verification as a secondary path for:

- dynamic article pages
- Eastmoney / Zhihu / social trend checks

### `sentiment-analysis`

Use browser-backed sources for:

- Reddit thread reads
- X topic search
- Zhihu / Xiaohongshu topic heat

### `market-discovery`

Use browser-backed trend sources for:

- retail attention shifts
- hot-stock lists
- discussion spikes

## File-Level Implementation Plan

### Phase 1

- add `marketbot/agent/tools/browser.py`
- register browser tools in `marketbot/agent/tools/loader.py`
- add config schema fields in `marketbot/config/schema.py`
- add two skills:
  - `marketbot/skills/xueqiu-research/SKILL.md`
  - `marketbot/skills/eastmoney-live/SKILL.md`

Status:

- `browser.py`: added
- config schema fields: added
- `xueqiu-research`: added
- `eastmoney-live`: added

### Phase 2

- update:
  - `marketbot/skills/stock-data-sourcing/SKILL.md`
  - `marketbot/skills/news-intelligence/SKILL.md`
  - `marketbot/skills/sentiment-analysis/SKILL.md`
- add tests for browser tool schema and safety enforcement

### Phase 3

- add `social-signal-browser`
- add `browser-news-verifier`
- add route-priority rules so browser-backed skills are selected only when
  justified

## Testing Plan

### Unit Tests

- command construction
- mode-based action blocking
- allowlist enforcement
- adapter name validation
- timeout handling

### Integration Tests

- skip by default unless `bb-browser` is installed
- verify `browser_site` runs a harmless adapter command
- verify blocked actions fail in `safe` mode

### Local Smoke Test

Run the workspace smoke script after installing `bb-browser` and adapters:

```bash
python3 scripts/run_bb_browser_smoke.py \
  --command /abs/path/to/bb-browser \
  --check-login-site
```

What it checks:

- `bb-browser site wikipedia/summary TSMC`
- `bb-browser site reddit/search "NVDA earnings"`
- `MarketBot` `BrowserSiteTool` calling `wikipedia/summary`
- optional `xueqiu/hot-stock` probe, treating explicit login-required hints as a soft pass

## Non-Goals

- bundling the Chrome extension into MarketBot
- embedding the daemon into MarketBot
- maintaining `bb-sites` adapters inside this repository
- exposing unrestricted browser automation by default

## Success Criteria

MarketBot should be able to:

1. read authenticated browser-backed finance and social sources locally
2. use those sources through specialist skills rather than ad hoc prompts
3. preserve a strong safety model
4. improve A-share, social-signal, and dynamic-page research without weakening
   existing API-backed market tooling
