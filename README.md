# MarketBot (TypeScript)

A multi-agent trading analysis system scaffold. This is an analysis engine, not a signal generator.

## Quick start

```bash
npm install
npm run build
node dist/index.js setup
node dist/index.js analyze "Analyze BTC short-term"
```

Run tests:

```bash
npm test
```

Manage agents:

```bash
node dist/index.js agents list
node dist/index.js agents add analyst --name "Analyst" --default
node dist/index.js analyze --agent analyst "Analyze AAPL swing"
```
Legacy CLI alias: `tradebot` (prints a deprecation warning).
If you pass `--agent`, make sure it exists in `marketbot.json` (use `marketbot agents add`).

Config utilities:

```bash
node dist/index.js config show
node dist/index.js config validate
```

Skills:

```bash
node dist/index.js skills list
node dist/index.js skills list --agent analyst
node dist/index.js skills install /path/to/skill
node dist/index.js skills install https://github.com/org/skill-repo --name custom-skill
node dist/index.js skills remove custom-skill
node dist/index.js skills info custom-skill
node dist/index.js skills sync --agent analyst --remove-extra
node dist/index.js skills run chart-reader analyze "https://example.com/chart.png"
```

Built-in tools for skill dispatch: `echo`, `http_get`, `market_fetch`, `indicators_compute`, `report_render`, `market_summary`.

Tools CLI:

```bash
node dist/index.js tools list
node dist/index.js tools info market_fetch
node dist/index.js tools run echo "hello"
```

Sample `marketbot.json`:

```json
{
  "agents": {
    "defaults": {
      "workspace": "./marketbot-workspace/main",
      "ensureBootstrap": true
    },
    "list": [
      { "id": "main", "name": "MarketBot", "default": true }
    ]
  },
  "llm": {
    "provider": "mock"
  },
  "skills": {
    "allowlist": ["news-fetcher", "chart-reader"],
    "entries": {
      "news-fetcher": { "enabled": true }
    }
  }
}
```

Live data (auto providers + optional web search/scrape):

```bash
DATA_MODE=auto ENABLE_WEB_SEARCH=true SCRAPE_ALLOWLIST="finance.yahoo.com,binance.com" \
  node dist/index.js analyze --live --search "Analyze AAPL swing"
```

## Notes
- The CLI defaults to mock market data unless `--live`/`DATA_MODE` is set.
- Swap in a real LLM provider by implementing `LLMProvider` in `src/core/llm.ts`.
- Prompts live in `src/prompts/`.
- Workspace files (AGENTS.md/SOUL.md/TOOLS.md/etc) live under `marketbot-workspace/` by default.
- If no `--agent` is passed, MarketBot uses the default agent from `marketbot.json`.

## Data configuration
Environment variables:
- `DATA_MODE`: `mock` | `auto` | `api` | `scrape`
- `ENABLE_WEB_SEARCH`: set to `true` to allow search + scrape fallback
- `SCRAPE_ALLOWLIST`: comma-separated domains permitted for scraping
- `DATA_TIMEOUT_MS`: request timeout (ms)
- `SERPAPI_KEY` or `BING_SEARCH_KEY`: for web search providers
- `BINANCE_ENABLED`: set to `false` to disable Binance provider
- `YAHOO_FINANCE_ENABLED`: set to `false` to disable Yahoo Finance provider

## Config + workspace
- Config file: `marketbot.json` in repo root (override with `MARKETBOT_CONFIG_PATH`)
- Default workspace can be overridden with `MARKETBOT_WORKSPACE_DIR`
- Extra skills directories can be provided via `MARKETBOT_SKILLS_DIRS` (comma-separated)
- Managed skills dir can be overridden with `MARKETBOT_MANAGED_SKILLS_DIR` or `skills.managedDir`
- Skills can be allowlisted/denylisted in `marketbot.json` via `skills.allowlist` / `skills.denylist`

Skill metadata (in SKILL.md front-matter):

```yaml
---
name: chart-reader
description: Read chart screenshots
metadata: {"marketbot":{"skillKey":"chart-reader","emoji":"chart","invocation":{"userInvocable":true},"commands":[{"name":"analyze","description":"Analyze a chart","dispatch":{"kind":"tool","toolName":"chart_tool","argMode":"raw"}}]}}
---
```

Example MarketBot tool dispatch skill:

```yaml
---
name: market-scan
description: Fetch and summarize market data
metadata: {"marketbot":{"skillKey":"market-scan","commands":[{"name":"fetch","description":"Fetch BTC data","dispatch":{"kind":"tool","toolName":"market_fetch","argMode":"raw"}}]}}
---
```

## LLM providers
MarketBot ships with `mock` and `openai-compatible` providers.

Example:

```json
{
  "llm": {
    "provider": "openai-compatible",
    "model": "gpt-4o-mini",
    "baseUrl": "https://api.openai.com/v1",
    "apiKeyEnv": "OPENAI_API_KEY",
    "jsonMode": true
  }
}
```

## Structure
- `src/agents/` agent runners + specs
- `src/core/` pipeline and LLM interface
- `src/data/` mock market data
- `src/prompts/` system + agent prompts
