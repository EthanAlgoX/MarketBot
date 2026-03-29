# marketbot Skills

This directory contains built-in skills that extend marketbot's capabilities.

When no suitable local skill is selected, marketbot can also surface curated external suggestions from:

- `https://github.com/openclaw/skills`
- `https://github.com/VoltAgent/awesome-openclaw-skills`

You can also search and install them with:

```bash
marketbot skills search "your query"
marketbot skills install <slug>
marketbot skills score show
marketbot skills score reset --skill <name>
```

## Skill Format

Each skill is a directory containing a `SKILL.md` file with:
- YAML frontmatter (name, description, metadata)
- Markdown instructions for the agent

## Attribution

These skills are adapted from [OpenClaw](https://github.com/openclaw/openclaw)'s skill system.
The skill format and metadata structure follow OpenClaw's conventions to maintain compatibility.

## Available Skills

## Routing, Scoring, and Fallback

Built-in skills are no longer selected only by static trigger matching.
Runtime selection now combines:

- metadata compatibility: `triggers`, `required_tools`, `markets`, `asset_classes`, `freshness`
- dynamic routing score: historical success/failure by scenario bucket
- fallback appending: compatible `fallback_skills` are appended behind the primary skill
- same-turn retry: if the primary skill clearly fails, the first fallback skill is retried once

Dynamic score buckets are keyed by:

- `skill_name`
- `market`
- `task_type`
- `toolset_signature`

Scores are persisted under the workspace data directory:

```text
~/.marketbot/workspace/data/skill_scores.json
```

Useful CLI commands:

```bash
marketbot skills score show
marketbot skills score show --skill xueqiu-research --json
marketbot skills score reset --skill xueqiu-research
marketbot skills score reset --all
```

Current high-value fallback mappings:

- `eastmoney-live -> news-intelligence`
- `xueqiu-research -> social-signal-browser, sentiment-analysis`
- `browser-news-verifier -> news-intelligence`

### Capability Matrix

| Category | Skills |
|-------|-------------|
| `market-analysis` | `market-report`, `market-monitor`, `market-discovery`, `news-intelligence`, `sentiment-analysis`, `macro-regime`, `sector-breadth` |
| `event-driven` | `catalyst-tracker`, `earnings-readout`, `risk-checklist`, `panic-reversion-monitor`, `thesis-tracker` |
| `screening-and-watch` | `daily-stock-screener`, `stock-watch`, `portfolio-analyzer` |
| `tech-intelligence` | `ak-rss-digest`, `tech-news-digest`, `intel-collector`, `intel-daily-digest`, `hackernews-browser-research`, `github-browser-research` |
| `specialist-research` | `options-payoff`, `pair-correlation`, `stock-data-sourcing`, `stock-info-explorer`, `logic-chain-visualizer`, `wechat-article-search`, `xueqiu-research`, `eastmoney-live`, `social-signal-browser`, `reddit-research`, `youtube-transcript-browser`, `github-browser-research`, `zhihu-browser-research`, `browser-news-verifier`, `weibo-browser-research`, `bilibili-browser-research`, `xiaohongshu-browser-research`, `twitter-browser-research`, `hackernews-browser-research`, `douban-browser-research`, `linkedin-browser-research`, `stackoverflow-browser-research`, `wikipedia-browser-research` |
| `platform-utility` | `github`, `summarize`, `weather`, `cron`, `tmux`, `clawhub`, `find-skills` |

| Skill | Description |
|-------|-------------|
| `github` | Interact with GitHub using the `gh` CLI |
| `weather` | Get weather info using wttr.in and Open-Meteo |
| `summarize` | Summarize URLs, files, and YouTube videos |
| `tmux` | Remote-control tmux sessions |
| `clawhub` | Search and install skills from ClawHub registry |
| `market-report` | Produce structured single-asset market analysis |
| `options-payoff` | Explain option strategy payoff, breakevens, and bounded or unbounded risk |
| `pair-correlation` | Analyze correlation, beta, rolling co-movement, and spread divergence |
| `earnings-readout` | Summarize earnings beats, guidance changes, and price reaction drivers |
| `sector-breadth` | Judge whether a sector or theme move is broad, narrow, expanding, or fading |
| `macro-regime` | Classify macro backdrop into risk-on, risk-off, inflation, or policy-driven regimes |
| `xueqiu-research` | Use browser-backed Xueqiu adapters for hot stocks, feeds, and discussion context |
| `eastmoney-live` | Use browser-backed Eastmoney pages and headlines for A-share live context |
| `social-signal-browser` | Use browser-backed community platforms for discussion heat and retail attention shifts |
| `reddit-research` | Use browser-backed Reddit adapters for thread search and retail discussion context |
| `youtube-transcript-browser` | Use browser-backed YouTube adapters for transcripts and market-video analysis |
| `github-browser-research` | Use browser-backed GitHub adapters for repo, issue, and discussion research |
| `zhihu-browser-research` | Use browser-backed Zhihu adapters for topic heat and Chinese narrative context |
| `browser-news-verifier` | Use browser-backed site-native sources to verify or cross-check headlines and claims |
| `weibo-browser-research` | Use browser-backed Weibo adapters for topic heat and public narrative momentum |
| `bilibili-browser-research` | Use browser-backed Bilibili adapters for video and comment-driven market narratives |
| `xiaohongshu-browser-research` | Use browser-backed Xiaohongshu adapters for consumer-attention and brand heat signals |
| `twitter-browser-research` | Use Twitter/X tooling for search, threads, profiles, and fast market commentary |
| `twitter-publisher` | Publish or interact on Twitter/X through the local twitter-cli tool |
| `hackernews-browser-research` | Use browser-backed Hacker News adapters for technical and launch discussion |
| `ak-rss-digest` | Generate a script-backed Chinese reading digest from a fixed AI and tech RSS bundle |
| `tech-news-digest` | Generate a daily AI and tech news digest from a tiered source catalog |
| `intel-collector` | Manage RSS and intel sources, run collection, and maintain recurring intel schedules |
| `intel-daily-digest` | Build daily digests from collected intel items and manage recurring digest schedules |
| `intel_search` | Search collected workspace intel with local BM25 ranking for prior-news recall |
| `logic-chain-visualizer` | Render market transmission paths and causal narratives as Markdown + Mermaid diagrams |
| `douban-browser-research` | Use browser-backed Douban adapters for cultural heat and entertainment attention |
| `linkedin-browser-research` | Use browser-backed LinkedIn adapters for professional signals and hiring context |
| `stackoverflow-browser-research` | Use browser-backed Stack Overflow adapters for developer friction and adoption signals |
| `wikipedia-browser-research` | Use browser-backed Wikipedia adapters for concise background and historical context |
| `daily-stock-screener` | Screen daily stock watchlists into ranked candidates |
| `catalyst-tracker` | Build a catalyst list and event calendar |
| `risk-checklist` | Generate trade risk and position-sizing guardrails |
| `panic-reversion-monitor` | Score event-driven panic selloffs and detect staged reversion windows |
| `thesis-tracker` | Persist and update a market thesis as new evidence strengthens, weakens, or falsifies it |
| `stock-data-sourcing` | Route A/H/US market and news providers with fallback guidance |
| `stock-info-explorer` | Use local Yahoo Finance charts and indicator scripts |
| `crypto-gold-monitor` | Monitor BTC, ETH, gold, and silver from free APIs |
| `skill-creator` | Create new skills |

## Browser Asset Index

The highest-traffic browser-backed skills now split concrete adapter calls into
`references/adapter-examples.md` so `SKILL.md` can stay short and reusable.

Current skills with adapter reference files:

- `xueqiu-research`
- `eastmoney-live`
- `reddit-research`
- `youtube-transcript-browser`
- `browser-news-verifier`
- `twitter-browser-research`
- `bilibili-browser-research`
- `xiaohongshu-browser-research`

Use these reference files when you need exact `browser_site(...)` examples,
catalog-aligned adapter choices, or explicit fallback patterns.

## Browser Runtime Notes

The current `bb-browser` integration has been real-smoke-tested locally against
several adapter families.

Working adapters observed on 2026-03-17:

- `wikipedia/summary`
- `reddit/search`
- `youtube/search`
- `zhihu/hot`
- `yahoo-finance/quote`
- `xueqiu/hot-stock`

Adapters that exist but currently depend on browser state on this workstation:

- `eastmoney/news`
- `github/repo`
- `hackernews/top`
- `arxiv/search`

Use [`browser_adapter_catalog.md`](/Users/ethan/Documents/workspace/MarketBot/docs/browser_adapter_catalog.md)
as the runtime-facing source of truth for catalog choices and real smoke status.

## Recent Runtime Additions

- `market_event_extract` and `market_social_sentiment` now support a pluggable
  sentiment backend configured by `tools.market.sentimentBackend`
- `intel_search` searches collected workspace intel from the local SQLite store
  and is intended to support thesis tracking, prior-news recall, and digest
  follow-ups
- `logic_chain_visualizer` renders low-dependency Markdown + Mermaid diagrams
  for transmission chains and event-causality explanations
- `thesis_tracker` persists theses and updates them as `strengthened`,
  `weakened`, `unchanged`, or `falsified`
- `market_brief` can now attach prior intel context, render a logic-chain
  appendix, and create or update a thesis in one pass
- explainability metadata now includes `fallbackExecution` when a fallback skill
  actually took over the turn
