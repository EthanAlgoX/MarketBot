# marketbot Skills

This directory contains built-in skills that extend marketbot's capabilities.

When no suitable local skill is selected, marketbot can also surface curated external suggestions from:

- `https://github.com/openclaw/skills`
- `https://github.com/VoltAgent/awesome-openclaw-skills`

You can also search and install them with:

```bash
marketbot skills search "your query"
marketbot skills install <slug>
```

## Skill Format

Each skill is a directory containing a `SKILL.md` file with:
- YAML frontmatter (name, description, metadata)
- Markdown instructions for the agent

## Attribution

These skills are adapted from [OpenClaw](https://github.com/openclaw/openclaw)'s skill system.
The skill format and metadata structure follow OpenClaw's conventions to maintain compatibility.

## Available Skills

### Capability Matrix

| Category | Skills |
|-------|-------------|
| `market-analysis` | `market-report`, `market-monitor`, `market-discovery`, `news-intelligence`, `sentiment-analysis`, `macro-regime`, `sector-breadth` |
| `event-driven` | `catalyst-tracker`, `earnings-readout`, `risk-checklist` |
| `screening-and-watch` | `daily-stock-screener`, `stock-watch`, `portfolio-analyzer` |
| `specialist-research` | `options-payoff`, `pair-correlation`, `stock-data-sourcing`, `stock-info-explorer`, `wechat-article-search`, `xueqiu-research`, `eastmoney-live`, `social-signal-browser`, `reddit-research`, `youtube-transcript-browser`, `github-browser-research`, `zhihu-browser-research`, `browser-news-verifier`, `weibo-browser-research`, `bilibili-browser-research`, `xiaohongshu-browser-research`, `twitter-browser-research`, `hackernews-browser-research`, `douban-browser-research`, `linkedin-browser-research`, `stackoverflow-browser-research`, `wikipedia-browser-research` |
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
| `twitter-browser-research` | Use browser-backed Twitter/X adapters for threads and fast market commentary |
| `hackernews-browser-research` | Use browser-backed Hacker News adapters for technical and launch discussion |
| `douban-browser-research` | Use browser-backed Douban adapters for cultural heat and entertainment attention |
| `linkedin-browser-research` | Use browser-backed LinkedIn adapters for professional signals and hiring context |
| `stackoverflow-browser-research` | Use browser-backed Stack Overflow adapters for developer friction and adoption signals |
| `wikipedia-browser-research` | Use browser-backed Wikipedia adapters for concise background and historical context |
| `daily-stock-screener` | Screen daily stock watchlists into ranked candidates |
| `catalyst-tracker` | Build a catalyst list and event calendar |
| `risk-checklist` | Generate trade risk and position-sizing guardrails |
| `stock-data-sourcing` | Route A/H/US market and news providers with fallback guidance |
| `stock-info-explorer` | Use local Yahoo Finance charts and indicator scripts |
| `crypto-gold-monitor` | Monitor BTC, ETH, gold, and silver from free APIs |
| `skill-creator` | Create new skills |
