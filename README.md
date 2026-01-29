# TradeBot (TypeScript)

A multi-agent trading analysis system scaffold. This is an analysis engine, not a signal generator.

## Quick start

```bash
npm install
npm run build
node dist/index.js setup
node dist/index.js analyze "Analyze BTC short-term"
```

Manage agents:

```bash
node dist/index.js agents list
node dist/index.js agents add analyst --name "Analyst" --default
node dist/index.js analyze --agent analyst "Analyze AAPL swing"
```
If you pass `--agent`, make sure it exists in `tradebot.json` (use `tradebot agents add`).

Config utilities:

```bash
node dist/index.js config show
node dist/index.js config validate
```

Skills:

```bash
node dist/index.js skills list
node dist/index.js skills list --agent analyst
```

Sample `tradebot.json`:

```json
{
  "agents": {
    "defaults": {
      "workspace": "./tradebot-workspace/main",
      "ensureBootstrap": true
    },
    "list": [
      { "id": "main", "name": "TradeBot", "default": true }
    ]
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
- Workspace files (AGENTS.md/SOUL.md/TOOLS.md/etc) live under `tradebot-workspace/` by default.
- If no `--agent` is passed, TradeBot uses the default agent from `tradebot.json`.

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
- Config file: `tradebot.json` in repo root (override with `TRADEBOT_CONFIG_PATH`)
- Default workspace can be overridden with `TRADEBOT_WORKSPACE_DIR`
- Extra skills directories can be provided via `TRADEBOT_SKILLS_DIRS` (comma-separated)

## Structure
- `src/agents/` agent runners + specs
- `src/core/` pipeline and LLM interface
- `src/data/` mock market data
- `src/prompts/` system + agent prompts
