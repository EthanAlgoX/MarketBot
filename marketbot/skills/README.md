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

| Skill | Description |
|-------|-------------|
| `github` | Interact with GitHub using the `gh` CLI |
| `weather` | Get weather info using wttr.in and Open-Meteo |
| `summarize` | Summarize URLs, files, and YouTube videos |
| `tmux` | Remote-control tmux sessions |
| `clawhub` | Search and install skills from ClawHub registry |
| `market-report` | Produce structured single-asset market analysis |
| `daily-stock-screener` | Screen daily stock watchlists into ranked candidates |
| `catalyst-tracker` | Build a catalyst list and event calendar |
| `risk-checklist` | Generate trade risk and position-sizing guardrails |
| `stock-data-sourcing` | Route A/H/US market and news providers with fallback guidance |
| `stock-info-explorer` | Use local Yahoo Finance charts and indicator scripts |
| `crypto-gold-monitor` | Monitor BTC, ETH, gold, and silver from free APIs |
| `skill-creator` | Create new skills |
