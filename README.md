<p align="center">
  <img src="assets/logo.png" width="120" alt="MarketBot Finance Logo">
</p>

# MarketBot Finance

> **Autonomous Financial Intelligence Agent with Multi-Channel Messaging**

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL_v3-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org/)

MarketBot Finance is an autonomous AI agent designed for financial analysis and market intelligence. It operates across multiple messaging platforms (Discord, Telegram, Signal, Slack, WhatsApp, iMessage) and provides deep reasoning capabilities through a multi-agent architecture.

---

## Architecture

```mermaid
graph TB
    subgraph Channels["📡 Channels"]
        Discord[Discord]
        Telegram[Telegram]
        Signal[Signal]
        Slack[Slack]
        WhatsApp[WhatsApp]
        iMessage[iMessage]
        Web[Web UI]
    end

    subgraph Core["🧠 Core"]
        Gateway[Gateway]
        Agents[Multi-Agent Reasoning]
        Memory[Memory & Context]
    end

    subgraph Tools["🔧 Tools"]
        Browser[Browser Automation]
        Skills[Skills & Plugins]
        Media[Media Understanding]
    end

    Channels --> Gateway
    Gateway --> Agents
    Agents --> Memory
    Agents --> Tools
    Tools --> Agents
    Agents --> Gateway
    Gateway --> Channels
```

---

## Core Components

| Component | Description |
|-----------|-------------|
| **Gateway** | Central message routing and channel orchestration |
| **Agents** | Multi-agent LLM reasoning with financial specialization |
| **Channels** | Discord, Telegram, Signal, Slack, WhatsApp, iMessage integrations |
| **Browser** | Headless browser for web research and data scraping |
| **Skills** | Extensible plugin system for custom analysis workflows |
| **Daemon** | Background service management and scheduling |
| **TUI/CLI** | Interactive terminal interface and command-line tools |
| **Web UI** | Dashboard for configuration and monitoring |

---

## Quick Start

### Installation

```bash
git clone https://github.com/EthanAlgoX/MarketBot.git
cd MarketBot
pnpm install
pnpm build
```

### Launch

```bash
# Interactive Terminal UI
pnpm tui

# Start as Daemon
pnpm daemon start

# Run CLI Commands
pnpm cli --help
```

---

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Key environment variables:

| Variable | Description |
|----------|-------------|
| `LLM_PROVIDER` | AI provider (openai, anthropic, gemini, etc.) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_AI_API_KEY` | Google AI API key |

---

## Skills & Extensibility

MarketBot supports a modular skill system. Browse available skills:

```bash
pnpm cli skills list
```

Install a skill:

```bash
pnpm cli skills install <skill-name>
```

Create custom skills in the `skills/` directory following the plugin SDK.

---

## Deployment

### Docker

```bash
docker-compose up -d
```

### Systemd (Linux)

```bash
pnpm cli daemon install
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
