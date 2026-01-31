<p align="center">
  <img src="assets/logo.png" width="120" alt="MarketBot Finance Logo">
</p>

# 📈 MarketBot Finance

> **Autonomous Financial Intelligence & Quantitative Analysis Engine**

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL_v3-blue.svg)](LICENSE)
[![Focus: Finance](https://img.shields.io/badge/focus-finance-success.svg)](#)
[![Status: Beta](https://img.shields.io/badge/status-beta-orange.svg)](#)
[![Built with: TypeScript](https://img.shields.io/badge/built%20with-TypeScript-blue.svg)](#)

**MarketBot Finance** is a high-performance, programmable financial agent designed to autonomously analyze markets, aggregate economic intelligence, and provide actionable trading insights. Built on a multi-agent reasoning framework, it bridges the gap between raw market data and high-stakes decision making.

---

## 💎 Core Pillars

### 🧠 Deep Reasoning & Multi-Agent Logic

MarketBot Finance doesn't just fetch data; it *understands* it. By coordinating multiple specialized agents, it can cross-reference technical signals with sentiment analysis and fundamental reports.

### 🌐 Autonomous Market Research

When data is missing or out-of-date, MarketBot Finance launches its own browser-based research sessions to hunt for real-time news, filings, and sentiment indicators across the web.

### 🔌 Extensible Skill Architecture

A professional-grade plugin system allows you to build custom data pipelines, proprietary indicators, and specialized analysis workflows in TypeScript.

---

## 🏛️ Architecture

```mermaid
graph TD
    Data[Market Data / Web / Filings] --> |Ingest| Gateway[MarketBot Gateway]
    Gateway --> |Route| Agent[Multi-Agent Reasoning]
    Agent --> |Call| Tools[Technical / Sentiment Tools]
    Tools --> |Return| Agent
    Agent --> |Analyze| Output[Actionable Intelligence]
    Output --> |Deliver| UI[Terminal TUI / Web / Signal]
```

---

## 🚀 Quick Start

### 1. Installation

```bash
git clone https://github.com/yourusername/marketbot.git
cd marketbot
pnpm install
pnpm build
```

### 2. Launch the Control Center (TUI)

Experience the full power of MarketBot through its interactive terminal interface:

```bash
pnpm tui
```

### 3. Example Queries

- `Evaluate NVDA technicals against current semiconductor sentiment.`
- `Analyze BTC support levels using Volume Profile and RSI.`
- `Scan for latest FOMC minutes and summarize market impact.`

---

## 🛠️ Specialized Tooling

MarketBot Finance includes built-in tools for:

- **Web Research**: Headless browser automation for real-time data scraping.
- **Data Analysis**: Local and LLM-driven quantitative auditing.
- **Multimodal**: Image analysis for chart pattern recognition.
- **Connectivity**: Integrated delivery via Signal, Telegram, Slack, and Discord.

---

## 📜 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.
See [LICENSE](LICENSE) for details.
