[English](README.md) | [简体中文](README_zh-CN.md)

# MarketBot

[Financial workflows](docs/finance_workflows.md) · [Integrations and deployment](docs/integrations.md)

MarketBot is a financial research agent for individual investors: cross-market research, portfolio risk and ongoing monitoring. It draws on [Nanobot](https://github.com/HKUDS/nanobot)'s lightweight agent architecture and extends the existing runtime with financial tools, skills and MCP integrations.

Its core workflow connects attributable evidence, currency-aware calculations, explicit thesis rules and change alerts. Skills provide research methods, tools retrieve and calculate facts, and the model organizes the analysis. Source timestamps and missing data remain visible throughout the workflow.

The financial workflow provides four concrete capabilities:

- **Attributable research:** inspect immutable evidence, actual observation times and explicit source gaps across markets.
- **Currency-aware portfolio risk:** calculate holdings, cash, concentration and user-defined stress scenarios with Decimal arithmetic and explicit FX.
- **Investment thesis tracking:** review numeric conditions against matching original evidence; incomplete or stale facts preserve the prior state.
- **Ongoing change monitoring:** retain a valid baseline, alert on threshold transitions and portfolio changes, and keep a durable local outbox.

This README describes development branch `codex/nanobot-finance-defaults`. Published PyPI packages may not yet include all these features. **Python 3.11+** is required. Illustrative prices and rule-based signals support research and testing; MarketBot does not execute real trades.

## Install and complete your first calculation

Install from source and create an isolated configuration and workspace. Run subsequent examples from the repository root, keeping these two variables set.

```bash
git clone --branch codex/nanobot-finance-defaults --single-branch https://github.com/EthanAlgoX/MarketBot.git
cd MarketBot
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e .

export MARKETBOT_CONFIG_PATH="$PWD/.local/readme/config.json"
export MARKETBOT_WORKSPACE="$PWD/.local/readme/workspace"
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" onboard
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" status --json
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance call portfolio_risk --input examples/finance/portfolio.json
```

The calculation requires no model, market-data account or network connection. Example prices and exchange rates are assumptions: total value should be **60000 CNY**, declining to **50000 CNY** after a uniform 20% equity shock. Cash is unaffected. Decimal arithmetic preserves numerical precision; missing currency or required FX rates return an error instead of a partial valuation.

Configuration and workspace are separate paths. Every command accepts global `--config` and `--workspace` before the subcommand; existing local options remain available. Without overrides, commands use `~/.marketbot/config.json` and its configured workspace. Initialize a missing custom configuration with `onboard`. Invalid existing configuration fails without replacing the file.

Refresh an existing installation while preserving provider, channel and user settings:

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" onboard --refresh
```

## Choose English or Simplified Chinese

English is the default language: `agents.defaults.language` is `"en"`. Use `"zh"` for Simplified Chinese. Command names and JSON field names remain stable in English; original provider data and user-written research notes retain their text.

```json
{"agents": {"defaults": {"language": "en"}}}
```

Use a global override for one invocation. Ordinary commands leave the saved preference unchanged. `onboard` is an explicit exception: creating or refreshing configuration saves the selected language.

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" --language zh status
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" --language zh agent -m "研究600519、0700.HK和SPY，列出实际观测时间、证据与风险。"
```

Save a preference, inspect it, or switch back to English:

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" language --set zh
marketbot --config "$MARKETBOT_CONFIG_PATH" language --json
marketbot --config "$MARKETBOT_CONFIG_PATH" language --set en
```

Agent replies, market report sections and intelligence daily digest sections follow the selected language; an explicit user request for another output language takes priority. Initialization, language settings and key status screens support both languages. Technical `--help`, command names, JSON fields, provider errors and financial tool warnings retain their original text.

The agent invocation requires a configured model. Existing custom workspace instructions are preserved; review any instructions that explicitly request a different response language. The Chinese documentation is available through the language links at the top of each guide.

## Financial workflow

### 1. Calculate a portfolio and retain evidence

`finance call` executes financial tools directly, taking a JSON object and returning JSON. Failures use a nonzero exit code. Portfolio calculation returns an `evidenceRecordId`; retrieve its full calculation inputs, output and digest verification information:

```bash
# Replace ev_... with the complete evidenceRecordId from the calculation
python -c 'import json; json.dump({"evidenceId": "ev_..."}, open(".local/readme/evidence.json", "w"))'
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance call evidence_get --input .local/readme/evidence.json
```

`evidence_list` supports symbol, kind and source filters. Observation, publication and retrieval timestamps remain separate; retrieval time cannot replace the actual source time. An evidence reference supports inspection, not a guarantee that the source is correct.

### 2. Create a verifiable investment hypothesis

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance call thesis_tracker --input examples/finance/thesis.json
```

Retain the returned `thesis.id`. This example creates an explicit rule that falsifies the hypothesis if a verified observed price falls below 1000 CNY, and preserves zero confidence. `update` stores research notes; `review` checks evidence IDs and JSON Pointers against rules. Negative language, model opinions, missing facts and stale data cannot automatically falsify a thesis. See [financial workflows](docs/finance_workflows.md) for complete lookup, review and FX examples.

### 3. Monitor meaningful changes

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance call market_watch --input examples/finance/watch.json
# Replace WATCH_ID with the returned watch.watchId
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance poll WATCH_ID
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance schedule WATCH_ID --every-minutes 15
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance schedule-list
# Keep the process running; Ctrl+C stops it
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" gateway --finance-only
```

`poll` requires a reachable public quote source. The first valid observation establishes a baseline; default price rules compare against that fixed baseline and alert once per threshold episode. Stale prices, unknown source times, missing quotes or FX produce `data_gap` without advancing the baseline. A nonzero poll exit code then signals a data-quality failure. Set `maxAgeSeconds` appropriately for market closures without presenting an old close as a current quote.

Scheduling only persists a job. A running Gateway executes it. `--finance-only` runs native finance and intelligence jobs without a model. Full Gateway also handles chat, model jobs and Heartbeat and requires model configuration. Remove jobs with `finance unschedule JOB_ID`. Local alerts remain in the watch outbox; query and acknowledge them through `market_watch` actions `outbox` / `ack`. Channel delivery requires configured credentials and explicit `--deliver --channel CHANNEL --to TARGET`. Delivery is at least once, so retries can duplicate an externally received message.

### 4. Retrieve market data and reports

```bash
mkdir -p .local/readme
python -c 'import json; json.dump({"symbols": ["600519", "0700.HK", "SPY"]}, open(".local/readme/snapshot.json", "w"))'
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance call market_snapshot --input .local/readme/snapshot.json
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" market report --symbols 600519,0700.HK,SPY --save
```

Public sources may be delayed, rate-limited or unavailable. Inspect warnings, source health and each quote's provider, currency, price type and timestamp. Empty news is not proof that nothing happened. Mock data is explicitly labeled. FRED and some search, TickFlow and Alpha Vantage capabilities require separate keys. Missing-data fallbacks are not actual macroeconomic observations.

## Configure a model and use the agent

Complete the local calculation first. A model is required for `agent`, full Gateway, model jobs and model Heartbeat.

For an OpenAI-compatible service, set your own endpoint, model ID and key. The script merges provider settings into the existing configuration and retains the financial presets. Keep this file local.

```bash
export MARKETBOT_MODEL='YOUR_MODEL_ID'
export MARKETBOT_API_BASE='https://YOUR_ENDPOINT/v1'
read -s MARKETBOT_API_KEY
export MARKETBOT_API_KEY
python - <<'PY'
import json, os
from pathlib import Path
path = Path(os.environ["MARKETBOT_CONFIG_PATH"])
data = json.loads(path.read_text())
data["providers"]["custom"].update(apiKey=os.environ["MARKETBOT_API_KEY"], apiBase=os.environ["MARKETBOT_API_BASE"])
data["agents"]["defaults"].update(provider="custom", model=os.environ["MARKETBOT_MODEL"])
path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
path.chmod(0o600)
PY
unset MARKETBOT_API_KEY
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" agent -m "Research 600519, 0700.HK and SPY: show observation times, evidence, risks and open questions."
```

Use `marketbot ... agent` for interactive chat, `--session` for a specific conversation and `--no-markdown` for plain text. The runtime supports tool calls, subtasks, saved sessions, memory consolidation, skill selection and MCP. Quality depends on the actual model and data; deterministic protocol fixtures do not assess real model quality. Other providers and OAuth login are covered in the [integration guide](docs/integrations.md).

## Features and boundaries

| Feature | Entry points | Requirements and limits |
| --- | --- | --- |
| Configuration and diagnostics | `onboard`, `status`, `channels status` | Configuration and dependency availability; OAuth `not_checked` does not mean logged in |
| 18 native financial tools | `finance call`, agent tool calls | Quotes, fundamentals, news, sentiment, macro, rule signals, chip estimates, source planning, events, logic graphs, briefs, intelligence, portfolios, evidence, theses and watches |
| Financial MCP | `python -m marketbot.mcp.finance` | stdio, 12 read-only tools sharing native implementations; use native tools for write workflows |
| 63 bundled skills and scoring | `skills search/install`, `skills score show/reset` | Research, markets, ETFs, portfolios and risk; operational success scores are not investment returns |
| Intelligence | `intel source-add/source-list/collect/digest-daily/digest-list/digest-show` | RSS and websites, deduplication and local storage; fetching HTML is not complete page understanding |
| Native scheduling | `intel schedule-*`, `finance schedule*`, `gateway --finance-only` | Cron or interval jobs; keep the process running |
| Agent and Heartbeat | `agent`, `gateway`, `market heartbeat-setup` | Require a model; finance-only does not execute model Heartbeat |
| 10 chat channels | `channels status/login`, `gateway` | Telegram, Discord, WhatsApp, Feishu, Mochat, DingTalk, Slack, Email, QQ, Matrix; actual account tests require platform credentials |
| Browser, Lark, Xiaohongshu, Twitter | `tools.browser/larkCli/xiaohongshuCli/twitterCli` configuration | Optional authenticated CLI bridges; external writes follow configured permissions |
| Local RL and dataset exports | `rl evaluate/collect/build-dataset/train/export-openclaw` | Price simulation, rewards and export artifacts; current adapters do not train model parameters |
| RL HTTP and metrics | `rl serve-env/serve-metrics`, `rl *openclaw*` | Separate local HTTP services and training artifact inspection; Slime/GPU execution requires an external environment |
| Containers | Dockerfile / Compose | Gateway is a process without an HTTP API; WhatsApp bridge runs separately |

Consult `marketbot --help`, `marketbot finance --help`, `marketbot intel --help` and `marketbot rl --help` for full options. Skills do not add data APIs by themselves. Fundamental summaries, chip estimates and rule signals do not supply complete filings, actual ownership distributions or guaranteed returns.

## Intelligence and RL examples

```bash
# Public RSS availability depends on your network. Retain the actual Source ID.
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" intel source-add --name "Federal Reserve" --type rss --url https://www.federalreserve.gov/feeds/press_all.xml
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" intel source-list
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" intel collect
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" intel digest-daily --hours 24 --limit 20
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" intel digest-list
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" intel schedule-daily --every-minutes 60
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" intel schedule-list
# Remove with intel schedule-remove JOB_ID; run with gateway --finance-only

# Illustrative prices, not a historical backtest conclusion
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" rl evaluate --symbol SPY --prices 100,101,99,103 --action buy --json
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" rl collect --symbol SPY --prices 100,101,99,103 --output .local/readme/episodes.jsonl --json
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" rl build-dataset --input .local/readme/episodes.jsonl --output .local/readme/dataset.jsonl
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" rl train --dataset .local/readme/dataset.jsonl --output-dir .local/readme/trainer --dry-run --json
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" rl export-openclaw --dataset .local/readme/dataset.jsonl --output-dir .local/readme/openclaw --dry-run --json
```

`rl train --no-dry-run` currently also exports artifacts only. The generated Slime shim uses rule-based signals, not inference from a trained model. See the [integration guide](docs/integrations.md) and [RL design](docs/marketbot_rl_integration_plan.md) for launch, monitoring and environment requirements.

## Reproduce the evaluation

```bash
python -m pip install -e '.[dev]'
python -m pytest tests
python scripts/evaluate_finance.py --output .local/finance-evaluation.json
python scripts/evaluate_readme.py --output .local/readme-evaluation.json
# Optional public quote/news/macro checks, dependent on network and sources
python scripts/evaluate_readme.py --network --output .local/readme-network-evaluation.json
```

The README evaluator uses temporary workspaces and real CLI subprocesses, local HTTP fixtures for RSS and model protocols, and an independent MCP stdio process. Fixtures do not validate real model quality, external channel delivery, profitability or live data accuracy. Repeat the walkthrough with a clean wheel installation outside the repository.

See the [English-first evaluation](docs/english_first_language_evaluation_2026-10-03.md) for the current bilingual release checks and the [feature evaluation report](docs/readme_feature_evaluation_2026-10-03.md) for broader coverage, fixes and unconfigured integrations. Financial acceptance covers precision, FX, evidence integrity, stale data, forged observations, explicit hypothesis review and alert idempotency.

## Architecture and references

`marketbot/agent` owns the agent loop, sessions, memory, tools and skills; `runtime` composes services; `domain/market` owns financial logic and evidence; `domain/intel` owns intelligence; `channels` handles platforms; `mcp` owns the protocol; `rl` owns simulation and training bridges. CLI, native finance tools and MCP share domain implementations.

`reference/nanobot.json` tracks the upstream reference snapshot, updated to `ae1eb02cd8a1266ea9912c048893310a28e9d9fe`. The local checkout lives in the workspace's shared `reference/nanobot` directory. MarketBot continues to maintain its own runtime.

Other references include [OpenBB](https://github.com/OpenBB-finance/OpenBB), [TradingAgents](https://github.com/TauricResearch/TradingAgents), [AI Hedge Fund](https://github.com/virattt/ai-hedge-fund), [FinRobot](https://github.com/AI4Finance-Foundation/FinRobot), [Qlib](https://github.com/microsoft/qlib) and [RD-Agent](https://github.com/microsoft/RD-Agent). Reference directions, licenses and tradeoffs are recorded in the [product direction](docs/marketbot_financial_agent_direction.md). Priorities include user portfolios and research history, filings, event calendars, source cross-checking and observable costs.

MIT License. Preserve attribution and applicable licenses when distributing third-party skills or reference code.
