[English](finance_defaults.md) | [简体中文](finance_defaults_zh-CN.md)

# MarketBot Finance Defaults

MarketBot separates its generic executor, progressively loaded skills, and configurable
MCP integrations from financial domain services. The CLI and gateway provide research,
portfolio risk calculations, and continuous monitoring.

## Initialization and upgrades

```bash
uv sync --extra dev
uv run marketbot onboard
# Existing configuration: preserve models, API keys, market sources, custom MCP settings, and workspace templates
uv run marketbot onboard --refresh
# Separate configuration and workspace
uv run marketbot onboard --config ./finance-config.json --workspace ./finance-workspace
uv run marketbot status --config ./finance-config.json --json
uv run marketbot agent --config ./finance-config.json -m "Analyze NVDA fundamentals, catalysts, and risks."
```

Initialization enables financial domain tools by default, includes skills for research,
earnings, catalysts, risk, portfolios, options, macroeconomics, and stock screening, and
creates financial research assistant templates. Both English and Chinese requests can
select the core finance skills. A skill with the same name in a custom workspace takes
priority. Existing templates are retained; refresh creates only missing templates.

## Display language

`agents.defaults.language` defaults to `"en"`; `"zh"` selects Simplified Chinese.
Save the default language or override a single invocation:

```bash
uv run marketbot --config ./finance-config.json language --set zh
uv run marketbot --config ./finance-config.json language --set en
uv run marketbot --config ./finance-config.json --language zh status
```

For ordinary commands, `--language` does not change the saved configuration. Creating or
refreshing configuration through `onboard` saves the selected language. Agent responses
and generated reports use the selected language; an explicit user request for another
output language takes precedence. Financial JSON field names, source content, user text,
and provider errors retain their original form.

## Default MCP

`tools.mcpServers.finance` is enabled by default and starts directly in the Python
environment where MarketBot is installed. Starting this service requires no npm,
additional MCP package, or financial data account. It reuses the financial domain tools
and their parameter validation:

| Original tool name | Purpose |
| --- | --- |
| `market_source_plan` | Data source routing for A-shares, Hong Kong, and US markets |
| `market_snapshot` | Quote snapshots |
| `market_fundamentals` | Fundamentals and valuation fields |
| `market_news` | Market news |
| `market_macro` | Macroeconomic data |
| `market_event_extract` | Catalyst and event extraction |
| `market_social_sentiment` | Community sentiment |
| `market_chip_distribution` | A-share chip distribution |
| `portfolio_risk` | Deterministic portfolio valuation, cross-currency weights, concentration, and hypothetical stress scenarios |
| `evidence_get` / `evidence_list` | Read and validate existing research evidence and claim references |
| `logic_chain_visualizer` | Render a supplied logic chain as Markdown / Mermaid |

Client tool names are `mcp_finance_<original tool name>`. MarketBot's native financial
tools use the same data services, and the Agent prefers native tools. Compatible clients
can also use the MCP interface independently:

```json
{
  "tools": {
    "mcpServers": {
      "finance": {
        "command": "/absolute/path/to/MarketBot/.venv/bin/python",
        "args": ["-m", "marketbot.mcp.finance", "--config", "/absolute/path/to/finance-config.json"],
        "toolTimeout": 60,
        "enabledTools": ["market_source_plan", "market_snapshot", "market_fundamentals"]
      }
    }
  }
}
```

MarketBot's own default configuration stores `command: "python"`. At runtime it selects
the current interpreter and passes the effective market configuration and workspace to
the subprocess. Disabling `tools.market.enabled` also disables the default finance MCP.
Refresh retains an existing custom `finance` MCP configuration and an explicit
`enabled: false` setting.

`enabledTools` accepts original names or complete client tool names. `["*"]` allows all
tools; `[]` registers none. `startupTimeout` sets the total budget for connection,
initialization, and tool discovery; `toolTimeout` controls each call. Failed connections
are cleaned up individually, allowing other services to remain available.

## Optional Alpha Vantage

Initialization also writes a disabled `alphavantage` preset using the
[official local MCP package](https://github.com/alphavantage/alpha_vantage_mcp) and its
`uvx marketdata-mcp-server YOUR_API_KEY` interface. Before enabling it, install `uv` and
set the environment variable:

```bash
export ALPHA_VANTAGE_API_KEY="your-key"
```

Then set `tools.mcpServers.alphavantage.enabled` to `true` in the configuration.
`${ALPHA_VANTAGE_API_KEY}` is resolved when connecting; the configuration file retains
the placeholder. `command`, `args`, `env`, `url`, and `headers` all support `${VAR}`.
An enabled service with a missing variable is skipped. The status command shows only
variable names, enabled state, and local command availability. It neither displays
credentials nor initiates network requests.

Default quote requests fetch data separately by each symbol's market, then merge
A-share, Hong Kong, US, and other asset results. When some sources fail, successful
quotes are retained and missing symbols are listed explicitly, so partial results are
not presented as complete coverage.

## Portfolio risk calculations

The portfolio analysis skill first obtains actual holdings, prices, and explicit
exchange rates, then calls the read-only `portfolio_risk` tool. Quantities, prices,
cash, exchange rates, and scenario shocks accept decimal strings. Monetary results are
also returned as decimal strings to preserve precision. An exchange rate means units
of the reporting currency per one unit of foreign currency. Missing required exchange
rates or invalid prices return errors rather than silently dropping holdings. Input
sources and observation times are retained, and missing sources are disclosed.

Calculations cover market value, weights, cash and currency exposure, holding
concentration, and an explicitly assumed uniform price shock. The model explains the
results. Correlation, Sharpe ratios, beta, returns, and optimized weights require actual
historical series and separate calculations; quote snapshots cannot supply invented
estimates. Examples and the input contract are in
[portfolio-analyzer](../marketbot/skills/portfolio-analyzer/SKILL.md).

Plan execution passes evidence collected by earlier steps into subsequent steps. An
empty allowlist prohibits all tool calls, and execution enforces the same scope described
in the prompt. Product direction and comparable projects are documented in
[the financial agent direction](marketbot_financial_agent_direction.md).

## Validation boundaries

Offline tests cover configuration upgrades, skill routing, MCP allowlists, pagination,
timeouts, and isolation, plus initialization, tool discovery, and source planning over
the actual stdio protocol. Package checks also validate skill support assets.
`configured` means only that local configuration satisfies startup requirements; it does
not mean a financial endpoint is connected or live quotes are available. Quotes, news,
and macroeconomic data remain subject to network access, source authorization, and rate
limits. Generating research with an LLM also requires model credentials.

The early baseline on 2026-10-03 passed all 833 pytest cases and Ruff checks for changed
files. Both sdist and wheel included all 113 skill assets. An actual default finance MCP
request for `SPY`, `600519`, and `0700.HK` returned three quotes with no missing symbols.
Online LLM conversations and the Alpha Vantage interface were not tested.

The 833 cases describe an early baseline, rather than the final regression count for
this update. The current complete regression suite passed **1332 cases**. Bilingual
runtime and package validation are recorded in
[the English-first language evaluation](english_first_language_evaluation_2026-10-03.md).

The portfolio tool also passed an actual stdio MCP call: explicit illustrative inputs
produced a total value of `60000 CNY`. Assuming holding prices decline uniformly by 20%
while cash and exchange rates remain unchanged, the result is `50000 CNY`, labeled as
a hypothetical scenario. This verifies protocol and calculations; it does not establish
that the supplied inputs are live market observations.
