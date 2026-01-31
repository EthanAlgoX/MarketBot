<p align="center">
  <img src="assets/logo.png" width="120" alt="MarketBot Finance Logo">
</p>

# MarketBot Finance

> **Autonomous Financial Intelligence Agent with Multi-Channel Messaging**

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL_v3-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

MarketBot Finance is an autonomous AI agent designed for financial analysis and market intelligence. It operates across multiple messaging platforms and provides deep reasoning capabilities through a multi-agent architecture.

---

## Architecture (MarketBot Focus)

MarketBot is designed around a gateway-first runtime with a market analysis
engine that can operate in real time, across channels, and with tool-assisted
research. The focus is actionable market intelligence: structured analysis,
clear risk/invalidation levels, and reproducible workflows.

### 1) Gateway-first control plane

- The Gateway is the central WebSocket server for sessions, routing, and tool
  execution.
- CLI, TUI, and Web UI connect to the Gateway, or run embedded locally with
  `--local` for single-machine use.

### 2) Analysis engine (agents + models)

- Agents orchestrate model calls, enforce prompts, and structure outputs for
  trading analysis.
- Model providers and fallbacks are configured per agent, so you can mix
  research models and execution models.

### 3) Tools and skills (market advantage)

- Tools enable web search/fetch, browser automation, memory, and data parsing.
- Skills encapsulate repeatable market workflows (reports, risk checklists,
  catalyst tracking).

### 4) Channels and nodes

- Multi-channel messaging for alerts and delivery (Telegram, Slack, Discord,
  WhatsApp, Signal, iMessage, Web).
- Nodes (macOS/iOS/Android/headless) provide device-level capabilities such as
  canvas, camera, screen, or location.

### 5) Persistence and configuration

- State lives under `~/.marketbot` (sessions, logs, caches).
- Config is JSON5 and can be set via `MARKETBOT_CONFIG_PATH` or
  `~/.marketbot/marketbot.json`.

## Core Components

- **Gateway**: WebSocket server for sessions, routing, and tool execution.
- **Agents**: Market-focused prompt orchestration, model selection, and output shaping.
- **Channels**: Multi-channel delivery and inbound routing.
- **Tools**: Web search/fetch, browser automation, memory, media, and exec.
- **Skills**: Reusable market workflows (reports, catalysts, risk checks).
- **Nodes**: Device clients with UI/canvas/camera/screen capabilities.
- **CLI/TUI**: Operator UX for analysis and command execution.

## Repo Layout

- `src/agents/`: agent runtime, prompts, compaction, tool wiring.
- `src/gateway/`: WebSocket server, protocol handling, routing.
- `src/channels/`: channel adapters (Telegram, Slack, Discord, etc.).
- `src/cli/`: CLI/TUI commands and UX helpers.
- `src/memory/`: memory store and retrieval.
- `src/providers/`: model/provider integrations and adapters.
- `extensions/`: plugin manifests and optional integrations.
- `skills/`: reusable skills and workflows.
- `apps/`: native clients (macOS, iOS, Android).
- `docs/`: documentation sources.

---

## Quick Start

### Installation

```bash
git clone https://github.com/EthanAlgoX/MarketBot.git
cd MarketBot
pnpm install
pnpm build
```

#### 1. Configure Environment

Create a `.env` file and set your credentials.

```bash
cp .env.example .env
# Edit .env to add your API keys and a Gateway Token:
# MARKETBOT_GATEWAY_TOKEN=marketbot123
```

#### 2. Start the Gateway

The Gateway manages your sessions and model connections. **You must leave this process running.**

```bash
pnpm start -- gateway
```

#### 3. Connect via TUI

Open a **new terminal window or tab**, and connect to your gateway. It will automatically use the token from your `.env`.

```bash
pnpm tui
```

#### 3. One-off Analysis

Run structured analysis directly from the CLI.

```bash
pnpm start -- analyze --asset BTC --timeframe 1h
```

---

## TUI Commands

The Terminal UI provides market-focused slash commands:

### System Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/status` | Gateway status |
| `/model <name>` | Switch model |
| `/agent <id>` | Switch agent |
| `/session <key>` | Switch session |

### Market Analysis

| Command | Description |
|---------|-------------|
| `/analyze <symbol>` | Quick market analysis with catalysts |
| `/technicals <symbol>` | Technical analysis (RSI, MACD, S/R) |
| `/sentiment [symbol]` | Sentiment analysis |
| `/news [symbol]` | Latest market news |
| `/portfolio` | Portfolio overview |
| `/watch <symbol>` | Add to watchlist |

**Example:**

```bash
/analyze NVDA
/technicals SPY
```

---

## Configuration

MarketBot only requires a model/auth provider to start. Once you configure a
provider, you can launch immediately without any other confirmation steps.

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Key environment variables:

| Variable | Description |
|----------|-------------|
| `MARKETBOT_GATEWAY_TOKEN` | Secure token for Gateway authentication |
| `LLM_PROVIDER` | AI provider (openai, anthropic, gemini, etc.) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `GOOGLE_AI_API_KEY` | Google AI API key |

---

## Skills

MarketBot supports 55+ extensible skills:

| Category | Skills |
|----------|--------|
| **Finance** | market-report, catalyst-tracker |
| **Productivity** | notion, obsidian, apple-notes, trello |
| **Development** | github, coding-agent, skill-creator |
| **Communication** | discord, slack, telegram |
| **Media** | video-frames, openai-whisper, camsnap |
| **Utilities** | weather, 1password, tmux |

```bash
# List available skills
pnpm start -- skills list

# Install a skill
pnpm start -- skills install <skill-name>
```

---

## Deployment

### Docker

```bash
docker-compose up -d
```

### Systemd (Linux)

```bash
pnpm start -- gateway install
sudo systemctl enable marketbot
sudo systemctl start marketbot
```

---

## Documentation

- [CLI Reference](docs/cli/index.md)
- [Agent Configuration](docs/concepts/agent.md)
- [Skill Development](docs/cli/skills.md)
- [Channel Setup](docs/concepts/group-messages.md)

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See [LICENSE](LICENSE) for details.
