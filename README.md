# MarketBot (TypeScript)

MarketBot is a multi-agent **market analysis** system for crypto, stocks, and forex. It produces conditional, risk-aware reports and **does not** generate buy/sell signals.

## Who it's for

- Developers building automated analysis pipelines or dashboards
- MarketBot users who want repeatable, explainable market summaries

## Key features

- Multi-agent workflows with configurable agents and prompts
- Supports crypto, stocks, and forex (plus any asset that can be searched)
- Automatic web search + page fetching via browser automation
- Skills + tools dispatch system with allowlists and policy profiles
- Live data modes with providers and scrape fallbacks
- Session history with configurable storage limits
- HTTP server for programmatic access

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

Legacy CLI alias: `tradebot` (prints a deprecation warning).

## Web search & analysis

使用浏览器自动化搜索网页并分析交易相关信息：

```bash
# 使用 OpenAI (默认)
OPENAI_API_KEY="sk-..." node dist/index.js web-analyze "BTC 今日走势分析"

# 使用 DeepSeek
DEEPSEEK_API_KEY="sk-..." node dist/index.js web-analyze "GOOGL 股票分析"

# 资产分析（自动搜索价格、新闻、市场情绪）
OPENAI_API_KEY="..." node dist/index.js web-analyze --asset ETH

# JSON 输出
node dist/index.js web-analyze "SOL price prediction" --json
```

### LLM 配置

**OpenAI (默认)**

配置 `marketbot.json`:

```json
{
  "llm": {
    "provider": "openai-compatible",
    "model": "gpt-4o-mini",
    "baseUrl": "https://api.openai.com/v1",
    "apiKeyEnv": "OPENAI_API_KEY"
  }
}
```

**DeepSeek**

```json
{
  "llm": {
    "provider": "openai-compatible",
    "model": "deepseek-chat",
    "baseUrl": "https://api.deepseek.com/v1",
    "apiKeyEnv": "DEEPSEEK_API_KEY"
  }
}
```

**浏览器搜索配置**

```json
{
  "web": {
    "search": {
      "provider": "browser",
      "maxResults": 5,
      "headless": true
    }
  }
}
```

> Tip: 设置 `apiKeyEnv` 为任意环境变量名称（如 `LLM_API_KEY`）以兼容其他 OpenAI 格式的 API。

## Live data & scraping

Live data uses providers by default and falls back to web search/scraping when enabled:

```bash
DATA_MODE=auto ENABLE_WEB_SEARCH=true \
SCRAPE_ALLOWLIST="finance.yahoo.com,binance.com" \
node dist/index.js analyze --live --search "Analyze AAPL swing"
```

Environment variables:

- `DATA_MODE`: `mock` | `auto` | `api` | `scrape`
- `ENABLE_WEB_SEARCH`: set to `true` to allow search + scrape fallback
- `SCRAPE_ALLOWLIST`: comma-separated domains permitted for scraping
- `DATA_TIMEOUT_MS`: request timeout (ms)
- `SERPAPI_KEY` or `BING_SEARCH_KEY`: for web search providers
- `BINANCE_ENABLED`: set to `false` to disable Binance provider
- `YAHOO_FINANCE_ENABLED`: set to `false` to disable Yahoo Finance provider

## Agents

```bash
node dist/index.js agents list
node dist/index.js agents add analyst --name "Analyst" --default
node dist/index.js analyze --agent analyst "Analyze AAPL swing"
```

If you pass `--agent`, make sure it exists in `marketbot.json` (use `marketbot agents add`).

## Skills & tools

Skills:

```bash
node dist/index.js skills list
node dist/index.js skills list --agent analyst
node dist/index.js skills check --eligible --verbose
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

Tool policy profiles:

- `minimal` (safe subset)
- `analysis` (default)
- `full` (all tools)

Per-agent overrides are supported via `agents.list[].tools`.

## HTTP server

```bash
node dist/index.js server --port 8787

curl -X POST http://127.0.0.1:8787/analyze \
  -H "Content-Type: application/json" \
  -d '{"query":"Analyze BTC short-term"}'
```

## Sessions

MarketBot can store session history for each agent run. Configure via:

- `sessions.enabled`
- `sessions.dir`
- `sessions.maxEntries`
- `sessions.maxEntryChars`
- `sessions.contextMaxChars`
- `sessions.includeContext`

## Config + workspace

- Config file: `marketbot.json` in repo root (override with `MARKETBOT_CONFIG_PATH`)
- Default workspace can be overridden with `MARKETBOT_WORKSPACE_DIR`
- Extra skills directories: `MARKETBOT_SKILLS_DIRS` (comma-separated)
- Managed skills dir: `MARKETBOT_MANAGED_SKILLS_DIR` or `skills.managedDir`
- Skills allowlist/denylist: `skills.allowlist` / `skills.denylist`
- Tools allow/deny: `tools.profile` or `tools.allow` / `tools.deny`
- Skill watcher: `skills.watch` and `skills.watchDebounceMs`
- HTTP server config: `server.host` / `server.port` or env `MARKETBOT_SERVER_HOST` / `MARKETBOT_SERVER_PORT`

Sample `marketbot.json`:

```json
{
  "agents": {
    "defaults": {
      "workspace": "./marketbot-workspace",
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
  },
  "tools": {
    "profile": "analysis"
  },
  "sessions": {
    "enabled": true,
    "maxEntries": 20
  }
}
```

## LLM providers

MarketBot 支持 `mock` 和 `openai-compatible` 两种 LLM 提供商。

### OpenAI (默认)

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

### DeepSeek

```json
{
  "llm": {
    "provider": "openai-compatible",
    "model": "deepseek-chat",
    "baseUrl": "https://api.deepseek.com/v1",
    "apiKeyEnv": "DEEPSEEK_API_KEY"
  }
}
```

### 其他 OpenAI 兼容 API

```json
{
  "llm": {
    "provider": "openai-compatible",
    "model": "your-model",
    "baseUrl": "https://your-endpoint/v1",
    "apiKeyEnv": "LLM_API_KEY"
  }
}
```

> 如需非 OpenAI 兼容的 API，可在 `src/core/llm.ts` 中实现自定义 `LLMProvider`。

## Notes

- This is **decision-support analysis**, not trading advice.
- The CLI defaults to mock market data unless `--live`/`DATA_MODE` is set.
- Prompts live in `src/prompts/` and agent runners live in `src/agents/`.
- Workspace files (AGENTS.md/SOUL.md/TOOLS.md/etc) live under `marketbot-workspace/` by default.

## Structure

- `src/agents/` agent runners + specs
- `src/core/` pipeline and LLM interface
- `src/data/` mock market data
- `src/prompts/` system + agent prompts
- `src/web/` web search, fetch, and browser automation
- `src/commands/` CLI commands including web-analyze
