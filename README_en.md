<div align="center">
  <img src="marketbot_logo.png" alt="marketbot" width="420">
  <h1>marketbot</h1>
  <p><strong>Skill-first finance analysis assistant with a lightweight agent runtime.</strong></p>
  <p><strong>English | <a href="README.md">中文</a></strong></p>
</div>

`marketbot` is an agent runtime built for financial analysis. It keeps the flexibility of a chat agent, but makes the finance layer explicit and maintainable:

- `skills` orchestrate high-level analysis tasks
- shared market-domain services handle `quote / news / macro`
- outputs can include `skill routing`, `data reliability`, `source health`, and `route trace`
- the same stack works across CLI, scheduled jobs, and chat channels

## What You Can Use It For

- generating market briefs for a symbol set or watchlist
- building catalyst and event watchlists from holdings
- running recurring watchlist monitoring and daily screening
- routing requests to the right skills based on market, asset class, freshness, and runtime tool availability
- sending channel-aware reports with reliability notes
- staying small enough that the core code is still practical to modify

## Why It Is Not Just Another Chatbot

- `Skill-first orchestration`
  Financial analysis is not one giant prompt. Skills declare triggers, output shape, risk, freshness, market coverage, asset classes, and required tools.
- `Independent domain layer`
  Quote, news, and macro access live in shared market services instead of being duplicated in every tool.
- `Explainable output`
  Chat replies, reports, and notifications can include skill routing, blocked reasons, source health, and data reliability.
- `Thin runtime`
  The runtime handles sessions, concurrency, tool execution, and channels instead of embedding finance logic in the main loop.
- `Built for iteration`
  The same analysis stack can power CLI usage, saved reports, recurring jobs, and outbound bots.

## Shortest Path To First Use

```bash
python3 -m venv .venv313
source .venv313/bin/activate
python -m pip install -e .
marketbot onboard
marketbot agent
marketbot agent -m "Give me the latest price for NVDA, 07709, and 513310"
marketbot agent -m "Build a two-week catalyst watchlist for NVDA, UNH, 07709, 07747, 513310, and 518880"
```

## Core Concepts

| Layer | Location | Responsibility |
| --- | --- | --- |
| `Skills` | `marketbot/skills/*/SKILL.md` | High-level orchestration: when to trigger, which market fits, which tools are required, and what output shape to use |
| `Market Domain` | `marketbot/domain/market/` | Standardized `quote / news / macro` access plus cache, source health, route trace, and runtime capability profiles |
| `Tools` | `marketbot/agent/tools/market.py` and related modules | Atomic capabilities such as `market_snapshot`, `market_news`, `market_macro`, and `market_brief` |
| `Reporting / Delivery` | `marketbot/market_reporting.py`, `marketbot/channels/*` | Render structured analysis into CLI replies, saved reports, notification summaries, and channel messages |

## Runtime Architecture

`marketbot` no longer relies on a single unbounded prompt loop. The current runtime is layered:

1. `Channels / CLI / Cron / Heartbeat`
   External entrypoints push work into one shared message bus, and outbound replies use the same bus.
2. `Session + Context`
   `session` persists JSONL history; `context` assembles history, memory, skills, and runtime metadata.
3. `Router`
   Classifies requests into `direct_react`, `planned_task`, `market_fast_path`, or `scheduled_task`.
4. `Planner`
   Builds a structured execution plan for complex tasks and limits each step with `allowed_tools`.
5. `Executor`
   Keeps the ReAct-style tool loop, but scopes execution to the current step instead of exposing the whole tool graph.
6. `Verifier + Plan Runtime`
   Decides whether a step is complete, should retry, or should replan; advances and persists plan state.
7. `Reporting / Delivery`
   Renders the final result into CLI responses, saved reports, notifications, or chat messages.

The main path is:

`Inbound -> MessageBus -> AgentLoop -> Router -> (Planner) -> Step Executor(ReAct) -> Verifier -> Outbound`

Relevant modules:

- `marketbot/agent/loop.py`
- `marketbot/agent/router.py`
- `marketbot/agent/planner.py`
- `marketbot/agent/executor.py`
- `marketbot/agent/verifier.py`
- `marketbot/agent/plan_runtime.py`
- `marketbot/channels/*`

### Why Planning + Bounded ReAct

- simple requests still go through direct ReAct for low latency
- complex tasks use planning first, then step-scoped execution, which is more stable across long tool chains
- tool health filters unhealthy tools before they are exposed to the model
- `subagent` now follows the same route / plan / verify flow, reducing drift between main-agent and sub-agent behavior

### How This Differs From A Single Big ReAct Loop

- not every request is dropped into one monolithic loop
- complex tasks no longer depend entirely on the model deciding all next actions implicitly
- tools are not exposed in one large set by default; they are filtered by health and by step allowlists
- plans are persisted under `workspace/plans/*.json` for recovery, debugging, and auditability

### Channels And Gateway

- `marketbot agent` is for local CLI interaction only
- `marketbot gateway` starts `channels.* + outbound dispatcher + agent loop`
- Feishu, Telegram, Slack, Discord, and other chat channels require the gateway process to stay online
- the current Feishu integration uses a WebSocket long connection instead of a public webhook, but it still depends on a running `gateway`

Common built-in skills:

| Skill | What it does |
| --- | --- |
| `market-report` | Structured market briefs for symbols or watchlists |
| `market-monitor` | Ongoing monitoring and market surveillance |
| `market-discovery` | Theme and idea discovery |
| `news-intelligence` | News clustering and impact analysis |
| `sentiment-analysis` | News and social sentiment synthesis |
| `portfolio-analyzer` | Portfolio-level risk and structure review |
| `daily-stock-screener` | Daily watchlist screening across valuation, trend, volume, and sentiment |
| `catalyst-tracker` | Event and catalyst tracking |
| `stock-watch` | Monitoring and summaries for specific symbols |
| `risk-checklist` | Risk framing around active setups |
| `ak-rss-digest` | Chinese AI and tech reading digests from a fixed RSS bundle |
| `tech-news-digest` | Daily AI and technology news digests from a tiered source catalog |
| `intel-collector` | Manage RSS and intel sources, run collection, and schedule recurring collection jobs |
| `intel-daily-digest` | Build daily digests from collected intel items and schedule recurring digest jobs |

## 5-Minute Quick Start

### 1. Install

```bash
git clone https://github.com/EthanAlgoX/MarketBot.git
cd MarketBot
python3 -m venv .venv313
source .venv313/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
```

If you need Matrix:

```bash
python -m pip install -e ".[matrix]"
```

For development:

```bash
python -m pip install -e ".[dev]"
```

Notes:

- Prefer running all `marketbot` commands inside a virtual environment
- If `pip` is not on your PATH, use `python -m pip ...`
- The project requires Python `>= 3.11`

### 2. Initialize config

```bash
marketbot onboard
```

This creates the default workspace and `~/.marketbot/config.json`.

### 3. Configure a model provider and market tools

Minimal example:

```json
{
  "providers": {
    "openrouter": {
      "apiKey": "sk-or-v1-xxx"
    }
  },
  "agents": {
    "defaults": {
      "provider": "openrouter",
      "model": "anthropic/claude-opus-4-1"
    }
  },
  "tools": {
    "market": {
      "quoteSource": "tickflow",
      "tickflowApiKey": "tk-xxx",
      "newsSources": ["reuters", "bloomberg", "cls"],
      "macroSource": "fred",
      "cacheTtlS": 60
    }
  },
  "channels": {
    "explainabilityMode": "auto",
    "explainabilityDelivery": "auto"
  }
}
```

Notes:

- `quoteSource: tickflow` is the best default when A-share realtime data is the priority; use `auto` for mixed-market workflows
- `tickflowApiKey` powers TickFlow realtime quote and fundamentals calls
- `newsSources` controls the news routing order
- `macroSource: fred` requires a FRED API key; without one, the system should degrade explicitly
- `explainabilityMode` controls whether capability and reliability notes are attached

Optional: if you want the agent to work directly with Feishu/Lark messages, docs, sheets, tasks, and Base/Bitable data, enable the local `lark-cli` tool layer:

```json
{
  "tools": {
    "larkCli": {
      "enabled": true,
      "command": "lark-cli",
      "timeoutS": 45,
      "configDir": "~/.lark-cli",
      "allowWrite": false,
      "allowAuth": false
    }
  }
}
```

Notes:

- `allowWrite: false` keeps the integration read-only by default
- `allowAuth: false` prevents the agent from triggering `lark-cli auth ...`
- enabling this registers `lark_cli`, `lark_im`, `lark_doc`, `lark_sheets`, `lark_task`, and `lark_base`
- this augments office-automation workflows and does not replace the existing `channels.feishu` message channel
- a dedicated `Lark CLI Integration` section below covers install, auth, validation, and examples

Optional: if you want the agent to analyze Twitter/X search results, threads, and account activity through a native local tool path, enable the local `twitter-cli` layer:

```json
{
  "tools": {
    "twitterCli": {
      "enabled": true,
      "command": "twitter",
      "timeoutS": 45,
      "browser": "chrome",
      "chromeProfile": "Profile 2",
      "homeDir": "~/.marketbot",
      "allowWrite": false
    }
  }
}
```

Notes:

- `browser` and `chromeProfile` let you pin cookie extraction to a specific browser/runtime profile
- `homeDir` is useful if you want isolated local state for `twitter-cli`
- `allowWrite: false` keeps the Twitter/X integration read-only by default
- enabling this registers `twitter_cli` and makes `twitter-browser-research` prefer the CLI path over `browser_site`
- a dedicated `Twitter CLI Integration` section below covers install, auth, validation, and examples

### 4. Start using it

The 4 commands most people need first:

```bash
source .venv313/bin/activate
marketbot agent
marketbot agent -m "Give me the latest price for NVDA, 07709, and 513310"
marketbot agent -m "Build a two-week catalyst watchlist for NVDA, UNH, 07709, 07747, 513310, and 518880"
marketbot market report --symbols NVDA,SPY --save
```

Also useful:

- `marketbot market report --json`: return the raw structured payload
- `marketbot market report --session premarket|intraday|close`
- `marketbot market report --notify --notify-channel telegram --chat-id 10001`
- `marketbot market heartbeat-setup`: create a recurring heartbeat template

If you want Feishu, Telegram, Slack, Discord, or other chat channels to receive and reply to messages, start:

```bash
source .venv313/bin/activate
marketbot gateway
```

`marketbot agent` is for local CLI interaction. Channel ingress and outbound replies run through `marketbot gateway`.

## Common Errors

### 1. `zsh: command not found: pip`

Cause: `pip` is not available on PATH, or the virtual environment is not activated.

Fix:

```bash
python3 -m venv .venv313
source .venv313/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
```

### 2. `error: externally-managed-environment`

Cause: macOS / Homebrew Python blocks direct package installation into the system environment under PEP 668.

Fix: do not install with system `pip install -e .`; use a virtual environment instead:

```bash
python3 -m venv .venv313
source .venv313/bin/activate
python -m pip install -e .
```

### 3. Feishu receives messages but MarketBot does not reply

Common cause: only `marketbot agent` is running; `marketbot gateway` is not.

Correct startup:

```bash
source .venv313/bin/activate
marketbot gateway
```

Checklist:

- run `marketbot status` and confirm Feishu is enabled
- verify `~/.marketbot/config.json` contains `appId` and `appSecret`
- keep the `marketbot gateway` process running
- if `allowFrom` is empty, Feishu messages are denied; during initial debugging you can use `["*"]`

### 4. `PermissionError` or session files cannot be written

Cause: `marketbot` writes sessions, cron state, and workspace files under `~/.marketbot/workspace/` by default.

Fix:

- make sure the current user can write to `~/.marketbot/`
- do not run a stateful `marketbot` process inside a read-only sandbox
- rerun `marketbot onboard` if you need to recreate the default directories

## Common Workflows

```bash
marketbot agent -m "Generate today's premarket watchlist for SPY,NVDA,GOOG,TSLA,UNH,07709,513310"
marketbot agent -m "List the most important catalysts and risks for NVDA, UNH, and 07709 over the next two weeks"
marketbot agent -m "Screen NVDA,TSLA,INTC,TTD,CRWV and rank today's best setups"
marketbot agent -m "Why does 07709 use this quote source? Show me the routing and reliability."
marketbot agent -m "Generate an AI reading digest from the fixed RSS bundle."
marketbot agent -m "Generate today's tech news digest focused on AI and developer tools."
```

## Tech-Intelligence Skills

In addition to market-analysis workflows, `marketbot` now ships three
tech-intelligence capability layers:

- `ak-rss-digest`
  Script-backed digest generation from a fixed RSS/Atom bundle, tuned for AI
  agents, frontier AI commentary, interviews, and high-signal essays.
- `tech-news-digest`
  Tiered source-catalog aggregation for AI and technology news, with `tier1`
  first-pass fetching and optional browser-backed enrichment for dynamic sites.
- `intel-collector` / `intel-daily-digest`
  Persistent RSS/intel source management, collection, digest generation, and
  cron scheduling for repeatable intel pipelines.

Typical prompts:

```bash
marketbot agent -m "Generate an AI reading digest from the fixed RSS bundle."
marketbot agent -m "Generate today's tech news digest focused on AI, model products, and developer tools."
```

If you want RSS collection and digest generation to run on a schedule, prefer
the `intel` command workflow:

```bash
marketbot intel source-add --type rss --name "OpenAI Blog" --url https://openai.com/blog/rss.xml
marketbot intel collect
marketbot intel digest-daily
marketbot intel digest-list
marketbot intel digest-show 1
marketbot intel schedule-latest-daily --collect-cron-expr "55 7 * * *" --digest-cron-expr "0 8 * * *" --tz Asia/Shanghai
marketbot intel schedule-list
marketbot intel schedule-remove <job-id>
```

`schedule-latest-daily` creates two cron jobs together:

- upstream `intel_collect` to refresh sources first
- downstream `intel_digest_daily` to build the digest from fresh items

## Explainability and Reliability

This is the part that most clearly separates `marketbot` from a generic chat agent.

The main explainability fields are:

| Field | Meaning |
| --- | --- |
| `skill routing` | which skills were selected |
| `blocked reasons` | which skills were not selected, and why |
| `data reliability` | aggregate status for `snapshot / news / macro` |
| `source health` | per-provider state such as `ok`, `cached`, `degraded`, `fallback`, or `error` |
| `route trace` | how data access was routed and downgraded |

These notes can appear in:

- chat replies
- saved market reports
- notification summaries
- outbound metadata

Relevant configuration:

- `channels.explainabilityMode`
- `channels.explainabilityOverrides`
- `channels.explainabilityDelivery`
- `channels.explainabilityDeliveryOverrides`

## Channels

| Channel | Notes |
| --- | --- |
| Telegram | via `python-telegram-bot` |
| Slack | Socket mode |
| Discord | REST + gateway |
| Feishu | text, post, and card-style output |
| DingTalk | Stream mode |
| Email | IMAP + SMTP |
| WhatsApp | bridge-based integration |
| QQ | bot integration |
| Mochat | Socket.IO + HTTP |
| Matrix | optional extra dependency |

Common commands:

```bash
marketbot gateway
marketbot status
marketbot channels --help
marketbot provider --help
marketbot skills --help
```

## Browser Integration

If you want `bb-browser` integration, start with a conservative configuration:

```json
{
  "tools": {
    "browser": {
      "enabled": true,
      "command": "bb-browser",
      "mode": "safe",
      "adapterCatalog": ["xueqiu/hot-stock", "reddit/search", "youtube/search", "zhihu/hot", "yahoo-finance/quote", "wikipedia/summary"],
      "allowSites": ["xueqiu", "reddit", "youtube", "zhihu", "yahoo-finance", "wikipedia"],
      "allowDomains": ["xueqiu.com", "reddit.com", "youtube.com", "zhihu.com", "finance.yahoo.com", "wikipedia.org"],
      "allowUrlPrefixes": ["https://www.youtube.com/watch?v=", "https://en.wikipedia.org/wiki/"],
      "allowEval": false,
      "allowRequestCapture": false,
      "allowRequestBodies": false
    }
  }
}
```

Key points:

- `safe` allows read-only browser operations
- `adapterCatalog` becomes the runtime allowlist for `browser_site`; when set, only listed `<site>/<command>` adapters may execute
- `allowSites` / `allowAdapters` still work as secondary constraints; they are the main boundary only when `adapterCatalog` is empty
- `allowDomains` / `allowUrlPrefixes` bound `browser_page(open)` and `browser_network(fetch)`
- `allowEval` should stay off unless page-side script evaluation is explicitly needed
- `allowRequestCapture` and `allowRequestBodies` should stay off unless explicitly needed

## Lark CLI Integration

If you want the agent to read or operate on Feishu/Lark messages, docs, spreadsheets, tasks, or Base/Bitable resources, you can wire local [`lark-cli`](https://github.com/larksuite/cli) into MarketBot. The recommended flow is:

1. install and verify `lark-cli` locally
2. complete CLI config and login outside MarketBot
3. enable `tools.larkCli`
4. validate with `marketbot status` and one real agent request

This integration is the office-execution layer. It does not replace `channels.feishu`, which remains the inbound/outbound chat channel integration.

### 1. Install `lark-cli`

Make sure the machine running MarketBot has a working `lark-cli` binary. The exact install method is up to you; what matters to MarketBot is:

- the runtime can execute the command
- `tools.larkCli.command` should ideally point to an absolute path

Example:

```json
{
  "tools": {
    "larkCli": {
      "enabled": true,
      "command": "/absolute/path/to/lark-cli",
      "timeoutS": 45,
      "configDir": "~/.lark-cli",
      "allowWrite": false,
      "allowAuth": false
    }
  }
}
```

Recommended defaults:

- use an absolute `command` path instead of relying on shell PATH
- set `configDir` explicitly, for example `~/.lark-cli`
- keep `allowWrite=false` during initial rollout
- keep `allowAuth=false` during initial rollout

### 2. Initialize and log in

Complete the CLI setup first instead of asking the agent to drive the auth flow:

```bash
lark-cli config init --new
lark-cli auth login
```

Notes:

- `config init --new` creates the local CLI config, typically under `~/.lark-cli/`
- `auth login` usually opens a browser or device-code authorization flow
- on macOS, the CLI may rely on Keychain access

Then run a minimal self-check:

```bash
lark-cli auth status
lark-cli doctor
lark-cli contact +get-user
```

If those work, MarketBot can usually use the same CLI context.

### 3. Configure MarketBot

Add this to `~/.marketbot/config.json`:

```json
{
  "tools": {
    "larkCli": {
      "enabled": true,
      "command": "/absolute/path/to/lark-cli",
      "timeoutS": 45,
      "configDir": "~/.lark-cli",
      "allowWrite": false,
      "allowAuth": false
    }
  }
}
```

Field reference:

- `enabled`: enables the `lark-cli` tool layer
- `command`: executable path to `lark-cli`; absolute path is preferred
- `timeoutS`: per-command timeout, default `45`
- `configDir`: CLI config directory; it must match the real directory used by `lark-cli`
- `allowWrite`: enables write operations such as sending messages, creating docs, or writing sheets
- `allowAuth`: allows the agent to invoke `auth` commands; usually leave this off

### 4. Validate with `marketbot status`

Before asking a complex question, check runtime visibility:

```bash
marketbot status
```

You should see lines like:

- `Lark CLI: ✓`
- `Lark CLI command: /absolute/path/to/lark-cli`
- `Lark CLI configDir: ~/.lark-cli`
- `Lark CLI writes: disabled`
- `Lark CLI auth: disabled`

If you see `command not found`, check:

- whether `tools.larkCli.command` points to the correct binary
- whether that binary is executable
- whether `configDir` matches the actual CLI config location

### 5. What tools the agent gets

When enabled, the runtime registers:

- `lark_cli`: generic fallback entry point for structured read-only queries not yet covered by specialized tools
- `lark_im`: chat and message search/read workflows
- `lark_doc`: document search and reads
- `lark_sheets`: normal spreadsheet reads
- `lark_task`: task reads and updates
- `lark_base`: Base/Bitable table, field, and record reads

Recommendation:

- prefer `lark_im`, `lark_doc`, `lark_sheets`, `lark_task`, and `lark_base`
- keep `lark_cli` as a fallback
- if the resource is really a Bitable/Base object, use `lark_base`, not `lark_sheets`

### 6. Stable use cases

The most stable read paths right now are:

- document search
- chat and message search
- normal spreadsheet reads
- task reads
- Base/Bitable table, field, and record reads

For Base/Bitable, the current integration supports:

- `table_list`
- `field_list`
- `record_list`
- `record_get`
- `record_list` with selected `fields`
- `record_list` with `field_filters` using either a simple dictionary or a small DSL
- automatic `table_name -> table_id` resolution

### 7. Example commands

Validate the CLI itself first:

```bash
lark-cli docs +search --query market --format json
lark-cli im +chat-search --query market --format json
lark-cli base +table-list --base-token YOUR_BASE_TOKEN --format json
```

Then validate through MarketBot:

```bash
marketbot agent -m "Search Feishu docs for titles related to market and return only the top 3."
marketbot agent -m "Find Feishu chats related to market."
marketbot agent -m "List all table names in Feishu Base XdkhbJehDazQKtscNpLchLXSnac."
marketbot agent -m "Read the table named 需求调研 in Feishu Base XdkhbJehDazQKtscNpLchLXSnac and return the first 2 records with only 编号, AI 情感打标, and 您的年龄范围？."
marketbot agent -m "Read the table named 需求调研 in Feishu Base XdkhbJehDazQKtscNpLchLXSnac and return only records where AI 情感打标 is 负向."
```

### 8. Base / Bitable guidance

Feishu spreadsheets and Feishu Base/Bitable are different resource types. Do not treat them as interchangeable:

- normal spreadsheets: use `lark_sheets`
- Base / Bitable resources: use `lark_base`

If you already know the `base_token`, you can now read by `table_name` directly instead of manually resolving `table_id` first. If the table name is ambiguous, the tool returns structured candidate names.

### 9. Safety boundaries

The default posture is intentionally conservative:

- write operations are disabled by default
- auth flows are disabled by default
- long-running event subscriptions are blocked
- file-output style flags are blocked
- for explicit Feishu/Lark office requests, the runtime prefers structured `lark_*` tools over shell `exec`

If you do need write access, enable it explicitly:

```json
{
  "tools": {
    "larkCli": {
      "allowWrite": true
    }
  }
}
```

Only do this in a controlled environment.

### 10. Common issues

- `marketbot status` shows `Lark CLI: disabled`
  Cause: `tools.larkCli.enabled` is still off.

- `marketbot status` shows `command not found`
  Cause: the configured binary path is wrong, or the command is not on PATH.

- `lark-cli auth status` fails in a restricted environment
  Cause: the CLI may depend on local Keychain or system credential access. Verify it in your normal terminal first.

- docs or sheets open fine in Feishu but tool calls return permission errors
  Cause: missing scopes. Fix the `lark-cli` authorization scopes first, then retry MarketBot.

- a resource looks like a sheet but `lark_sheets` cannot read it
  Cause: it may actually be a Bitable/Base resource. Use `lark_base`.

## Xiaohongshu CLI Integration

If [`xiaohongshu-cli`](https://github.com/jackwener/xiaohongshu-cli) is installed locally, you can expose it to the agent as a read-only tool. The recommended flow is: make sure `xhs` works locally first, then wire it into MarketBot.

### 1. Install and log in

Install `xiaohongshu-cli` into your Python environment and confirm the `xhs` command works. Then complete one login flow:

```bash
xhs login
# or
xhs login --qrcode
```

If you use browser-cookie login on macOS, Keychain may ask for access to Chrome storage. That prompt expects your macOS account password, not your Xiaohongshu password.

### 2. Configure MarketBot

Add this to `~/.marketbot/config.json`:

```json
{
  "tools": {
    "xiaohongshuCli": {
      "enabled": true,
      "command": "xhs",
      "timeoutS": 45,
      "cookieSource": "auto",
      "homeDir": "~/.marketbot",
      "allowWrite": false
    }
  }
}
```

Recommendations:

- Prefer an absolute path for `command`, for example `"/Users/you/project/.venv/bin/xhs"`, so runtime behavior does not depend on the shell PATH
- Set `homeDir` to a dedicated writable directory if you want isolated cookie/cache state
- Keep `allowWrite` set to `false`

### 3. Verify the path

Verify the CLI first:

```bash
xhs status --json
xhs search "luckin coffee" --sort popular --json
```

Then verify MarketBot:

```bash
marketbot agent -m "Use Xiaohongshu to analyze Luckin Coffee's recent heat, discussion themes, and overall sentiment. Keep it concise."
```

### 4. Runtime behavior

- The current integration is intentionally read-only and only exposes `status / search / read / comments / feed / hot / topics / search-user / user / user-posts`
- When `tools.xiaohongshuCli.allowWrite=true`, MarketBot also exposes a controlled `post` operation for image-note publishing
- The built-in `xiaohongshu-browser-research` skill prefers `xiaohongshu_cli` and only falls back to `browser_site` when the CLI is unavailable
- For default brand-analysis requests, runtime prefers `search(popular)` and only adds one freshness pass when needed; it no longer defaults to `exec`, local cache inspection, or browser-side Xiaohongshu scraping
- `xiaohongshu_cli` now compresses large search payloads into model-friendly summaries before returning them to the agent
- `homeDir` is optional; when set, MarketBot runs the CLI with `HOME` pointed at that directory so cookies/cache can live in an isolated location

### 5. Scope and risk

- It is useful for brand heat, consumer narratives, note/comment inspection, and creator-content research, not as direct proof of revenue or sell-through
- `allowWrite` is kept as an explicit safety switch, but MarketBot does not currently expose like/comment/favorite/post/follow operations
- The only write operation currently exposed is `post`, and it only supports image-note publishing; like/comment/favorite/follow are still not exposed
- The CLI still depends on local browser cookies or QR login; if `xhs status` fails, fix CLI authentication first instead of debugging MarketBot
- Treat Xiaohongshu output as consumer-attention context, not as a replacement for filings, channel checks, sales data, or official disclosures

## Twitter CLI Integration

If you want the agent to read Twitter/X search results, threads, user profiles, and user posts through a native local tool path, or to post in a controlled mode, integrate `twitter-cli`.

### 1. Install and authenticate `twitter-cli`

Install `twitter-cli` in your Python environment and confirm that the `twitter` command is runnable. Then either keep your browser logged in to X/Twitter or set:

```bash
export TWITTER_AUTH_TOKEN=...
export TWITTER_CT0=...
```

Before touching MarketBot, verify the CLI directly:

```bash
twitter status --json
twitter search "NVDA guidance" --type Latest --max 10 --json
```

### 2. Configure MarketBot

Add this to `~/.marketbot/config.json`:

```json
{
  "tools": {
    "twitterCli": {
      "enabled": true,
      "command": "twitter",
      "timeoutS": 45,
      "browser": "chrome",
      "chromeProfile": "Profile 2",
      "homeDir": "~/.marketbot",
      "allowWrite": false
    }
  }
}
```

Recommendations:

- Prefer an absolute path for `command`, for example `"/Users/you/project/.venv/bin/twitter"`
- Set `browser` only when you need to pin extraction order across multiple browsers; common values are `arc`, `chrome`, `edge`, `firefox`, `brave`
- Set `chromeProfile` only when you want a specific Chromium profile such as `"Profile 2"`
- Set `homeDir` to a dedicated writable directory if you want isolated local state
- Keep `allowWrite` set to `false`

### 3. Verify the path

Verify the CLI first:

```bash
twitter status --json
twitter user elonmusk --json
twitter search "TSLA deliveries" --type Latest --max 10 --json
```

Then verify MarketBot:

```bash
marketbot status
marketbot agent -m "Summarize the main Twitter discussion and overall sentiment around NVDA's latest guidance. Keep it concise."
```

### 4. Runtime behavior

- The current read path exposes `status / whoami / search / tweet / article / user / user_posts / likes / followers / following / feed / bookmarks / list`
- When `tools.twitterCli.allowWrite=true`, MarketBot also exposes controlled `post / reply / quote / like / unlike / retweet / unretweet / bookmark / unbookmark / follow / unfollow / delete`
- The built-in `twitter-browser-research` skill prefers `twitter_cli` and only falls back to `browser_site` when the CLI is unavailable
- For default Twitter/X analysis requests, runtime now prefers `twitter_cli` instead of `exec`, local cache inspection, or browser-side detours
- `homeDir` is optional; when set, MarketBot runs the CLI with `HOME` pointed at that directory so cookies and local state can stay isolated

### 5. Scope and risk

- It is useful for market narratives, thread analysis, analyst/trader commentary, and fast-moving event reaction, not as a single source of truth
- `allowWrite` is an explicit safety switch and should stay off unless you intentionally want the agent to post or interact
- The CLI still depends on local browser cookies or environment-based auth; if `twitter status` fails, fix CLI authentication first instead of debugging MarketBot
- Treat Twitter/X output as fast-signal context, not as a replacement for filings, exchange disclosures, or formal news sources

## Skill Search and Install

Search local skills first, then fall back to curated external catalogs:

```bash
marketbot skills search "kubernetes deployment"
marketbot skills install k8s-release
```

Installed external skills are written to `workspace/skills/` and loaded as workspace skills in the next session.

## Development

| Path | Purpose |
| --- | --- |
| `marketbot/agent/` | runtime loop, context, session processing |
| `marketbot/runtime/` | tool bootstrap and runtime wiring |
| `marketbot/domain/market/` | market services and runtime capability profiles |
| `marketbot/skills/` | built-in skills and metadata |
| `marketbot/channels/` | channel adapters |
| `marketbot/cache/` | market cache |
| `marketbot/market_reporting.py` | report rendering and explainability output |
| `tests/` | regression coverage |

Common command:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -p pytest_asyncio.plugin
```

Typical path for adding a new finance capability:

1. add or update a skill in `marketbot/skills/<name>/SKILL.md`
2. declare metadata for triggers, output, risk, freshness, markets, asset classes, and required tools
3. extend `marketbot/domain/market/` if you need new normalized data access
4. expose or adapt a tool if the skill needs a new atomic capability
5. add routing, contract, and report tests

## License

MIT
