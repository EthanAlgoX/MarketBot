<div align="center">

# 📈 MarketBot

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

> 🤖 Multi-Agent 市场分析系统 | 支持 Crypto · 股票 · 外汇 | AI 驱动的决策仪表盘

[**功能特性**](#-功能特性) • [**快速开始**](#-快速开始) • [**架构设计**](#-架构设计) • [**配置指南**](#-配置指南)

[English](README.md) | 简体中文

</div>

## ✨ 功能特性

### 🎯 核心功能

- **AI 决策仪表盘** - 一句话核心结论 + 精确买卖点位 + 风险检查清单
- **多 Agent 协作** - 意图解析 → 市场体制 → 风险评估 → 反思综合 → 报告生成
- **浏览器自动化** - 自动搜索新闻、抓取网页进行实时分析
- **多市场支持** - Crypto、A股/港股/美股、外汇及任意可搜索资产
- **多渠道推送** - 支持企业微信、飞书、Telegram、Webhook

### 🛡️ 交易理念内置

- ❌ **严禁追高** - 乖离率 > 5% 自动标记「危险」
- ✅ **趋势交易** - MA5 > MA10 > MA20 多头排列
- 📍 **精确点位** - 入场价、止损价、目标价
- 📋 **检查清单** - 每项条件用 ✅⚠️❌ 标记

### 📊 数据来源

- **行情数据**: Yahoo Finance、Binance（自动切换）
- **新闻搜索**: 浏览器自动化（DuckDuckGo/Bing）
- **AI 分析**: OpenAI、DeepSeek、及其他 OpenAI 兼容 API

## 🚀 快速开始

### 1. 安装

```bash
git clone https://github.com/EthanAlgoX/MarketBot.git
cd MarketBot
npm install
npm run build
```

### 2. 配置 API Key

**支持 OpenAI, DeepSeek, Google Gemini, Claude, 通义千问, Moonshot, Ollama**

详细配置请参考 [配置指南](#-配置指南) 章节。

**示例：DeepSeek (推荐/高性价比)**

```bash
# 方式一：环境变量
export DEEPSEEK_API_KEY="sk-..."

# 方式二：.env 文件
echo 'DEEPSEEK_API_KEY=sk-...' > .env
```

### 3. 运行分析

```bash
# 分析股票
node dist/index.js web-analyze "GOOGL 股票分析"

# 分析加密货币
node dist/index.js web-analyze "BTC 今日走势"

# 资产模式（自动搜索价格、新闻、情绪）
node dist/index.js web-analyze --asset ETH
```

### 4. 完成

首次运行会自动下载 Chromium 浏览器用于网页搜索。

## 📱 输出效果

### 决策仪表盘

```
📄 AI 股票分析报告
---
📅 2026-01-31 | AI Stock Trading Snapshot

## 🟦 核心结论

| 方向 & 置信度 | 交易参数 | 核心逻辑 |
|:---|:---|:---|
| 🟢 LONG ↑ | 入场: $338.00 | 上升趋势 |
| ⭐⭐⭐⭐☆ (80/100) | 止盈: $350.00 | 多头排列 |
| **趋势向上** | 止损: $320.00 | MACD 金叉 |

## 🟩 关键依据

### 📊 技术面
- 均线: 多头排列
- MACD: 金叉
- RSI: 正常区间

### 📰 事件/基本面
- 财报将于 2/4 发布
- 分析师评级: Strong Buy

## 🟥 风险 & 失效条件

- 市场波动风险
- 日线收盘跌破 $320 失效

---
⚠️ 免责声明: 本报告由 AI 生成，仅供研究参考，不构成投资建议。
```

## 🏗️ 架构设计

```
┌────────────────────────────────────────────────────────────────┐
│                         MarketBot                               │
├────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 核心流水线 (Core Pipeline)               │   │
│  │                                                          │   │
│  │  意图 → 数据 → 解读 → 体制 → 风险 → 反思 → 报告         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  专业 Agent 模块                         │   │
│  │                                                          │   │
│  │  ┌────────────┐ ┌────────────┐ ┌─────────────────┐      │   │
│  │  │ 意图解析   │ │ 市场体制   │ │    风险评估     │      │   │
│  │  └────────────┘ └────────────┘ └─────────────────┘      │   │
│  │                                                          │   │
│  │  ┌────────────┐ ┌────────────┐ ┌─────────────────┐      │   │
│  │  │  反思综合  │ │  报告生成  │ │    网页分析     │      │   │
│  │  └────────────┘ └────────────┘ └─────────────────┘      │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### Agent 模块

| Agent | 职责 | 输出 |
|-------|------|------|
| **IntentParser** | 解析用户查询意图 | asset, market, timeframes |
| **MarketDataInterpreter** | 解读市场数据 | structure, volatility, momentum |
| **MarketRegime** | 识别市场体制 | regime, strategy, confidence |
| **RiskAssessment** | 评估交易风险 | risk_level, position_size |
| **Reflection** | 综合分析、识别盲点 | confidence, alternatives |
| **ReportGenerator** | 生成专业报告 | Markdown Report |
| **WebDataAnalyzer** | 网页搜索+分析 | 搜索结果、分析报告 |

## ⚙️ 配置指南

### LLM 提供商

创建 `marketbot.json` 选择你喜欢的提供商：

| 提供商 | 模型 | Base URL | API Key 变量 |
|--------|------|----------|--------------|
| **OpenAI** | `gpt-4o-mini` | `https://api.openai.com/v1` | `OPENAI_API_KEY` |
| **DeepSeek** ⭐ | `deepseek-chat` | `https://api.deepseek.com/v1` | `DEEPSEEK_API_KEY` |
| **Gemini** | `gemini-2.0-flash` | `https://generativelanguage.googleapis.com/v1beta/openai` | `GEMINI_API_KEY` |
| **Claude** | `claude-3-5-sonnet-20241022` | `https://api.anthropic.com/v1` | `ANTHROPIC_API_KEY` |
| **通义千问** | `qwen-turbo` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `DASHSCOPE_API_KEY` |
| **Moonshot** | `moonshot-v1-8k` | `https://api.moonshot.cn/v1` | `MOONSHOT_API_KEY` |
| **Ollama** | `llama3.2` | `http://localhost:11434/v1` | - |

**配置示例：**

<details>
<summary><b>OpenAI (默认)</b></summary>

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

</details>

<details>
<summary><b>DeepSeek (推荐 ⭐)</b></summary>

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

</details>

<details>
<summary><b>Google Gemini (免费额度)</b></summary>

```json
{
  "llm": {
    "provider": "openai-compatible",
    "model": "gemini-2.0-flash",
    "baseUrl": "https://generativelanguage.googleapis.com/v1beta/openai",
    "apiKeyEnv": "GEMINI_API_KEY"
  }
}
```

免费获取: [Google AI Studio](https://aistudio.google.com/)
</details>

<details>
<summary><b>Anthropic Claude</b></summary>

```json
{
  "llm": {
    "provider": "openai-compatible",
    "model": "claude-3-5-sonnet-20241022",
    "baseUrl": "https://api.anthropic.com/v1",
    "apiKeyEnv": "ANTHROPIC_API_KEY"
  }
}
```

</details>

<details>
<summary><b>通义千问 (Qwen)</b></summary>

```json
{
  "llm": {
    "provider": "openai-compatible",
    "model": "qwen-turbo",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "apiKeyEnv": "DASHSCOPE_API_KEY"
  }
}
```

</details>

<details>
<summary><b>Moonshot (Kimi)</b></summary>

```json
{
  "llm": {
    "provider": "openai-compatible",
    "model": "moonshot-v1-8k",
    "baseUrl": "https://api.moonshot.cn/v1",
    "apiKeyEnv": "MOONSHOT_API_KEY"
  }
}
```

</details>

<details>
<summary><b>Ollama (本地部署)</b></summary>

```json
{
  "llm": {
    "provider": "openai-compatible",
    "model": "llama3.2",
    "baseUrl": "http://localhost:11434/v1",
    "apiKeyEnv": ""
  }
}
```

先运行: `ollama pull llama3.2`
</details>

### 浏览器配置

```json
{
  "web": {
    "search": {
      "provider": "browser",
      "maxResults": 5,
      "headless": false
    }
  }
}
```

> 设置 `headless: true` 在后台运行浏览器

### 通知渠道

| 变量 | 说明 |
|------|------|
| `WECHAT_WEBHOOK_URL` | 企业微信 Webhook URL |
| `FEISHU_WEBHOOK_URL` | 飞书 Webhook URL |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token |
| `TELEGRAM_CHAT_ID` | Telegram Chat ID |

## 🖥️ HTTP API

```bash
# 启动服务器
node dist/index.js server --port 8787

# 健康检查
curl http://127.0.0.1:8787/health

# 分析请求
curl -X POST http://127.0.0.1:8787/analyze \
  -H "Content-Type: application/json" \
  -d '{"query":"Analyze BTC"}'
```

## 📁 项目结构

```
MarketBot/
├── src/
│   ├── agents/          # 专业 Agent (7个)
│   ├── core/            # 流水线、LLM 接口
│   ├── pipeline/        # 股票分析流水线
│   ├── service/         # 统一服务层
│   ├── web/             # 浏览器搜索/抓取
│   ├── tools/           # 工具调度
│   ├── skills/          # 技能系统
│   ├── commands/        # CLI 命令
│   └── server/          # HTTP 服务器
├── marketbot.json       # 配置文件
└── package.json
```

## 🗺️ 开发路线

### 🔔 通知渠道

- [x] 企业微信机器人
- [x] 飞书机器人
- [x] Telegram Bot
- [x] 自定义 Webhook
- [ ] 邮件通知

### 🤖 AI 模型

- [x] OpenAI GPT-4/GPT-4o
- [x] DeepSeek
- [x] 通义千问
- [ ] 本地模型 (Ollama)

### 📊 数据源

- [x] Yahoo Finance
- [x] Binance
- [x] 浏览器搜索
- [ ] Tushare Pro
- [ ] AkShare

### 🎯 功能增强

- [x] 决策仪表盘
- [x] 多 Agent 协作
- [x] 一页式报告
- [x] HTTP API
- [ ] 历史分析回测
- [ ] GitHub Actions 定时运行

## ⚠️ 免责声明

本项目仅供学习和研究使用，不构成任何投资建议。股市有风险，投资需谨慎。作者不对使用本项目产生的任何损失负责。

## 📄 License

[AGPL-3.0 License](LICENSE) © 2026 EthanAlgoX

---

<div align="center">

**如果觉得有用，请给个 ⭐ Star 支持一下！**

</div>
