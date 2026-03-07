<div align="center">
  <img src="marketbot_logo.png" alt="marketbot" width="500">
  <h1>marketbot: Finance-First, Ultra-Lightweight AI Assistant</h1>
  <p>
    <b>The minimalist agent framework designed for quantitative research and personal automation.</b>
  </p>
  <p>
    <b><a href="README.md">English</a> | 中文</b>
  </p>

---

🐂 **marketbot** 是一个**金融优先 (Finance-First)** 的超轻量级个人 AI 助手。

- ⚡️ **极简核心**: 仅约 4,000 行 Python 代码，比传统复杂框架精简 99%。
- 📈 **金融洞察**: 内置强大的金融研究能力，自动化市场数据分析与报告合成。
- 🔗 **多维联接**: 无缝集成 Telegram, Discord, 飞书, 微信等主流 IM 渠道。
- 🛡️ **设计哲学**: 采用 "获取 -> 分析 -> 合成" 的确定性流程，拒绝臃肿。

---

</div>

## 💡 设计理念

MarketBot 坚信**少即是多（Less is more）**。在其他 Agent 框架变得日益庞杂臃肿时，MarketBot 始终专注三大核心支柱：

1. **确定性优于混乱**: 采用严格的“获取 -> 分析 -> 综合”工作流，以确保高标准且可复现的金融洞察分析结果。
2. **极简状态管理**: 独创“双层记忆”系统，使用 `MEMORY.md` 存储长效事实，使用 `HISTORY.md` 留存可搜索日志。默认完全不需要沉重的数据库依赖。
3. **高透明度**: 整个核心代码可以在一个下午轻松读完。专为需要精确掌握 Agent 每一步思考逻辑的研究员或量化交易员准备。

## 📦 安装

**Install from source** (latest features, recommended for development)

```bash
git clone https://github.com/HKUDS/marketbot.git
cd marketbot
pip install -e .
```

## 🚀 快速开始

**1. 初始化环境**

```bash
marketbot onboard
```

**2. 配置文件设置** (`~/.marketbot/config.json`)

MarketBot 的设计理念是“开箱即用”。只需填入你的模型 API key:

```json
{
  "providers": {
    "openrouter": {
      "apiKey": "sk-or-v1-xxx"
    }
  },
  "agents": {
    "defaults": {
      "model": "anthropic/claude-3-5-sonnet",
      "provider": "openrouter"
    }
  }
}
```

**3. 启动应用**

```bash
marketbot agent
```

> [!TIP]
> Visit [OpenRouter](https://openrouter.ai/keys) to get an API key that works with almost any model.

## 💹 核心金融能力

MarketBot 预装了一套专为量化研究、算法级市场监控和投资组合分析设计的**金融优先核心技能池**。由于 MarketBot 将这些技能抽象为可组合的工具调用管线（`SKILL.md`），它能够原生实现复杂的分析工作流。

### 🔭 Market Opportunity Discovery 机会发现 (`/discover`)

扫描全市场，综合市场数据、事件、情绪和板块动能，自动发现潜在投资机会。

- **核心管线**: 市场扫描 → 事件匹配 → 情绪变化追踪 → 资金流捕捉 → 板块联动分析。
- **评分引擎**: 基于加权模型（事件权重0.3 + 情绪0.3 + 量能0.2 + 板块动能0.2）过滤高胜率交易机会。
- **机会分类**: 将机会自动分为宏观、行业、公司个体及情绪驱动四类。

### 📈 Market Monitor 市场监控 (`/monitor`)

实时监控价格异动、宏观指标、板块轮动和突发新闻，生成可行动的交易预警。

- **监控模块**: 跟进宏观指标（如S&P、VIX、美债收益率）、市场异动（涨跌幅榜、异常放量）、板块轮动、技术面信号（RSI、突破）和财报冲击。
- **警报生成**: 一旦触发高风险阈值（例如VIX飙升或崩盘），立即生成实时警报，并在盘后生成AI结构化总结。

### 📊 Portfolio Analyzer 投资组合分析

全方位映射预期收益、执行场景压力测试并优化资产配置权重的工具包。

- **核心指标**: 自动测算预期收益 (CAGR)、波动率、夏普比率、最大回撤与 Beta 系数。
- **风险拆解**: 识别集中度风险，计算持仓资产间的相关性矩阵。
- **压力测试**: 在“大盘闪崩”或“激进加息”等假设场景下模拟组合抗压能力。
- **配置优化**: 使用均值-方差模型或最大夏普路径，提供提升风险调整后收益的调仓建议。

### 📰 News Intelligence 新闻情报 (`/news`)

抓取、去重并深度评估全球财经新闻流，测算其对市场的影响。

- **深度提取**: 精准识别文本实体，对事件（如财报、并购、监管）进行归类。
- **爆炸半径分析**: 追踪事件对“核心个股 -> 行业板块 -> 宏观市场”的链式冲击，定义短期或长期的影响边界。
- **趋势侦测**: 对相关通稿进行聚合聚类，发现爆发性主题并及时预警风险。

### 🎭 Sentiment Analysis 情绪分析 (`/sentiment`)

量化金融媒体及论坛散户的非标准情绪信号。

- **多源定权**: 区分新闻级信源(0.5)、社交媒体(0.3)与散户讨论社区(0.2)的权重。
- **动能速率追踪**: 摒弃单一时间点的绝对面值，横向计算情绪 $t$ 相对 $t-1$ 期的变化速率，精准捕捉情绪升温或降温拐点。

### 📉 Stock Watch 智能盯盘 (`/watch`)

为指定标的配置自动化的定时追踪与汇总。

- Utilizes the builtin `cron` skill to automate daily tracking of Prices, Technical Support/Resistance, and Catalysts.

## 💬 聊天应用

将 MarketBot 连接到你常用的聊天工具平台。

| Channel | 所需准备 |
|---------|---------------|
| **Telegram** | 通过 @BotFather 获取 token |
| **Discord** | Bot token 和 Message Content intent 权限 |
| **WhatsApp** | 直接扫码登录 |
| **Feishu** | 应用 ID 及应用密钥 (Secret) |
| **Mochat** | Claw 密令 (支持全自动配置) |
| **DingTalk** | 应用 Key 及应用密钥 (Secret) |
| **Slack** | Bot token 以及 App 级别 token |
| **Email** | IMAP 和 SMTP 邮箱授权账密 |
| **QQ** | 应用 ID 及应用密钥 (Secret) |

<details>
<summary><b>Telegram</b> (推荐使用)</summary>

**1. Create a bot**

- Open Telegram, search `@BotFather`
- Send `/newbot`, follow prompts
- Copy the token

**2. 配置文件设置**

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "allowFrom": ["YOUR_USER_ID"]
    }
  }
}
```

> You can find your **User ID** in Telegram settings. It is shown as `@yourUserId`.
> Copy this value **without the `@` symbol** and paste it into the config file.

**3. Run**

```bash
marketbot gateway
```

</details>

<details>
<summary><b>Mochat (Claw IM)</b></summary>

Uses **Socket.IO WebSocket** by default, with HTTP polling fallback.

**1. Ask marketbot to set up Mochat for you**

Simply send this message to marketbot (replace `xxx@xxx` with your real email):

```
Read https://raw.githubusercontent.com/HKUDS/MoChat/refs/heads/main/skills/marketbot/skill.md and register on MoChat. My Email account is xxx@xxx Bind me as your owner and DM me on MoChat.
```

marketbot will automatically register, configure `~/.marketbot/config.json`, and connect to Mochat.

**2. Re后台挂起网关**

```bash
marketbot gateway
```

That's it — marketbot handles the rest!

<br>

<details>
<summary>Manual configuration (advanced)</summary>

If you prefer to configure manually, add the following to `~/.marketbot/config.json`:

> Keep `claw_token` private. It should only be sent in `X-Claw-Token` header to your Mochat API endpoint.

```json
{
  "channels": {
    "mochat": {
      "enabled": true,
      "base_url": "https://mochat.io",
      "socket_url": "https://mochat.io",
      "socket_path": "/socket.io",
      "claw_token": "claw_xxx",
      "agent_user_id": "6982abcdef",
      "sessions": ["*"],
      "panels": ["*"],
      "reply_delay_mode": "non-mention",
      "reply_delay_ms": 120000
    }
  }
}
```

</details>

</details>

<details>
<summary><b>Discord</b></summary>

**1. Create a bot**

- Go to <https://discord.com/developers/applications>
- Create an application → Bot → Add Bot
- Copy the bot token

**2. Enable intents**

- In the Bot settings, enable **MESSAGE CONTENT INTENT**
- (Optional) Enable **SERVER MEMBERS INTENT** if you plan to use allow lists based on member data

**3. Get your User ID**

- Discord Settings → Advanced → enable **Developer Mode**
- Right-click your avatar → **Copy User ID**

**4. Configure**

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "allowFrom": ["YOUR_USER_ID"],
      "groupPolicy": "mention"
    }
  }
}
```

> `groupPolicy` controls how the bot responds in group channels:
>
> - `"mention"` (default) — Only respond when @mentioned
> - `"open"` — Respond to all messages
> DMs always respond when the sender is in `allowFrom`.

**5. Invite the bot**

- OAuth2 → URL Generator
- Scopes: `bot`
- Bot Permissions: `Send Messages`, `Read Message History`
- Open the generated invite URL and add the bot to your server

**6. Run**

```bash
marketbot gateway
```

</details>

<details>
<summary><b>Matrix (Element)</b></summary>

Install Matrix dependencies first:

```bash
pip install marketbot-ai[matrix]
```

**1. Create/choose a Matrix account**

- Create or reuse a Matrix account on your homeserver (for example `matrix.org`).
- Confirm you can log in with Element.

**2. Get credentials**

- You need:
  - `userId` (example: `@marketbot:matrix.org`)
  - `accessToken`
  - `deviceId` (recommended so sync tokens can be restored across restarts)
- You can obtain these from your homeserver login API (`/_matrix/client/v3/login`) or from your client's advanced session settings.

**3. Configure**

```json
{
  "channels": {
    "matrix": {
      "enabled": true,
      "homeserver": "https://matrix.org",
      "userId": "@marketbot:matrix.org",
      "accessToken": "syt_xxx",
      "deviceId": "MARKETBOT01",
      "e2eeEnabled": true,
      "allowFrom": ["@your_user:matrix.org"],
      "groupPolicy": "open",
      "groupAllowFrom": [],
      "allowRoomMentions": false,
      "maxMediaBytes": 20971520
    }
  }
}
```

> Keep a persistent `matrix-store` and stable `deviceId` — encrypted session state is lost if these change across restarts.

| Option | Description |
|--------|-------------|
| `allowFrom` | User IDs allowed to interact. Empty = all senders. |
| `groupPolicy` | `open` (default), `mention`, or `allowlist`. |
| `groupAllowFrom` | Room allowlist (used when policy is `allowlist`). |
| `allowRoomMentions` | Accept `@room` mentions in mention mode. |
| `e2eeEnabled` | E2EE support (default `true`). Set `false` for plaintext-only. |
| `maxMediaBytes` | Max attachment size (default `20MB`). Set `0` to block all media. |

**4. Run**

```bash
marketbot gateway
```

</details>

<details>
<summary><b>WhatsApp</b></summary>

Requires **Node.js ≥18**.

**1. Link device**

```bash
marketbot channels login
# Scan QR with WhatsApp → Settings → Linked Devices
```

**2. 配置文件设置**

```json
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "allowFrom": ["+1234567890"]
    }
  }
}
```

**3. Run** (two terminals)

```bash
# Terminal 1
marketbot channels login

# Terminal 2
marketbot gateway
```

> WhatsApp bridge updates are not applied automatically for existing installations.
> If you upgrade marketbot and need the latest WhatsApp bridge, run:
> `rm -rf ~/.marketbot/bridge && marketbot channels login`

</details>

<details>
<summary><b>Feishu (飞书)</b></summary>

Uses **WebSocket** long connection — no public IP required.

**1. Create a Feishu bot**

- Visit [Feishu Open Platform](https://open.feishu.cn/app)
- Create a new app → Enable **Bot** capability
- **Permissions**: Add `im:message` (send messages) and `im:message.p2p_msg:readonly` (receive messages)
- **Events**: Add `im.message.receive_v1` (receive messages)
  - Select **Long Connection** mode (requires running marketbot first to establish connection)
- Get **App ID** and **App Secret** from "Credentials & Basic Info"
- Publish the app

**2. 配置文件设置**

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_xxx",
      "appSecret": "xxx",
      "encryptKey": "",
      "verificationToken": "",
      "allowFrom": ["ou_YOUR_OPEN_ID"]
    }
  }
}
```

> `encryptKey` and `verificationToken` are optional for Long Connection mode.
> `allowFrom`: Add your open_id (find it in marketbot logs when you message the bot). Use `["*"]` to allow all users.

**3. Run**

```bash
marketbot gateway
```

> [!TIP]
> Feishu uses WebSocket to receive messages — no webhook or public IP needed!

</details>

<details>
<summary><b>QQ (QQ单聊)</b></summary>

Uses **botpy SDK** with WebSocket — no public IP required. Currently supports **private messages only**.

**1. Register & create bot**

- Visit [QQ Open Platform](https://q.qq.com) → Register as a developer (personal or enterprise)
- Create a new bot application
- Go to **开发设置 (Developer Settings)** → copy **AppID** and **AppSecret**

**2. Set up sandbox for testing**

- In the bot management console, find **沙箱配置 (Sandbox Config)**
- Under **在消息列表配置**, click **添加成员** and add your own QQ number
- Once added, scan the bot's QR code with mobile QQ → open the bot profile → tap "发消息" to start chatting

**3. Configure**

> - `allowFrom`: Add your openid (find it in marketbot logs when you message the bot). Use `["*"]` for public access.
> - For production: submit a review in the bot console and publish. See [QQ Bot Docs](https://bot.q.qq.com/wiki/) for the full publishing flow.

```json
{
  "channels": {
    "qq": {
      "enabled": true,
      "appId": "YOUR_APP_ID",
      "secret": "YOUR_APP_SECRET",
      "allowFrom": ["YOUR_OPENID"]
    }
  }
}
```

**4. Run**

```bash
marketbot gateway
```

Now send a message to the bot from QQ — it should respond!

</details>

<details>
<summary><b>DingTalk (钉钉)</b></summary>

Uses **Stream Mode** — no public IP required.

**1. Create a DingTalk bot**

- Visit [DingTalk Open Platform](https://open-dev.dingtalk.com/)
- Create a new app -> Add **Robot** capability
- **Configuration**:
  - Toggle **Stream Mode** ON
- **Permissions**: Add necessary permissions for sending messages
- Get **AppKey** (Client ID) and **AppSecret** (Client Secret) from "Credentials"
- Publish the app

**2. 配置文件设置**

```json
{
  "channels": {
    "dingtalk": {
      "enabled": true,
      "clientId": "YOUR_APP_KEY",
      "clientSecret": "YOUR_APP_SECRET",
      "allowFrom": ["YOUR_STAFF_ID"]
    }
  }
}
```

> `allowFrom`: Add your staff ID. Use `["*"]` to allow all users.

**3. Run**

```bash
marketbot gateway
```

</details>

<details>
<summary><b>Slack</b></summary>

Uses **Socket Mode** — no public URL required.

**1. Create a Slack app**

- Go to [Slack API](https://api.slack.com/apps) → **Create New App** → "From scratch"
- Pick a name and select your workspace

**2. 配置文件设置 the app**

- **Socket Mode**: Toggle ON → Generate an **App-Level Token** with `connections:write` scope → copy it (`xapp-...`)
- **OAuth & Permissions**: Add bot scopes: `chat:write`, `reactions:write`, `app_mentions:read`
- **Event Subscriptions**: Toggle ON → Subscribe to bot events: `message.im`, `message.channels`, `app_mention` → Save Changes
- **App Home**: Scroll to **Show Tabs** → Enable **Messages Tab** → Check **"Allow users to send Slash commands and messages from the messages tab"**
- **Install App**: Click **Install to Workspace** → Authorize → copy the **Bot Token** (`xoxb-...`)

**3. Configure marketbot**

```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      "allowFrom": ["YOUR_SLACK_USER_ID"],
      "groupPolicy": "mention"
    }
  }
}
```

**4. Run**

```bash
marketbot gateway
```

DM the bot directly or @mention it in a channel — it should respond!

> [!TIP]
>
> - `groupPolicy`: `"mention"` (default — respond only when @mentioned), `"open"` (respond to all channel messages), or `"allowlist"` (restrict to specific channels).
> - DM policy defaults to open. Set `"dm": {"enabled": false}` to disable DMs.

</details>

<details>
<summary><b>Email</b></summary>

Give marketbot its own email account. It polls **IMAP** for incoming mail and replies via **SMTP** — like a personal email assistant.

**1. Get credentials (Gmail example)**

- Create a dedicated Gmail account for your bot (e.g. `my-marketbot@gmail.com`)
- Enable 2-Step Verification → Create an [App Password](https://myaccount.google.com/apppasswords)
- Use this app password for both IMAP and SMTP

**2. 配置文件设置**

> - `consentGranted` must be `true` to allow mailbox access. This is a safety gate — set `false` to fully disable.
> - `allowFrom`: Add your email address. Use `["*"]` to accept emails from anyone.
> - `smtpUseTls` and `smtpUseSsl` default to `true` / `false` respectively, which is correct for Gmail (port 587 + STARTTLS). No need to set them explicitly.
> - Set `"autoReplyEnabled": false` if you only want to read/analyze emails without sending automatic replies.

```json
{
  "channels": {
    "email": {
      "enabled": true,
      "consentGranted": true,
      "imapHost": "imap.gmail.com",
      "imapPort": 993,
      "imapUsername": "my-marketbot@gmail.com",
      "imapPassword": "your-app-password",
      "smtpHost": "smtp.gmail.com",
      "smtpPort": 587,
      "smtpUsername": "my-marketbot@gmail.com",
      "smtpPassword": "your-app-password",
      "fromAddress": "my-marketbot@gmail.com",
      "allowFrom": ["your-real-email@gmail.com"]
    }
  }
}
```

**3. Run**

```bash
marketbot gateway
```

</details>

## 🌐 多元化 Agent 社区互联

�� 市场精灵天生具备直接切入高密度 Agent 社群的能力。**您只需要发送一条注册密令，剩余一切均由终端打理！**

| 挂载协议 | 入驻指引（向您的初始 bot 发送下列密令） |
|----------|-------------|
| [**汇聚型世界 - Moltbook**](https://www.moltbook.com/) | `Read https://moltbook.com/skill.md and follow the instructions to join Moltbook` |
| [**开源派对话 - ClawdChat**](https://clawdchat.ai/) | `Read https://clawdchat.ai/skill.md and follow the instructions to join ClawdChat` |

只要把上述对应的入驻指令发送进你的 marketbot 无论是在原生命令行下亦或社交容器内，代理程序将会包办后续的一切。

## ⚙️ 模型及运行环境配置

系统运行时所需的配置文件位于: `~/.marketbot/config.json`

### 模型支撑库 (Providers)

> [!TIP]
>
> - **Groq** provides free voice transcription via Whisper. If configured, Telegram voice messages will be automatically transcribed.
> - **Zhipu Coding Plan**: If you're on Zhipu's coding plan, set `"apiBase": "https://open.bigmodel.cn/api/coding/paas/v4"` in your zhipu provider config.
> - **MiniMax (Mainland China)**: If your API key is from MiniMax's mainland China platform (minimaxi.com), set `"apiBase": "https://api.minimaxi.com/v1"` in your minimax provider config.
> - **VolcEngine Coding Plan**: If you're on VolcEngine's coding plan, set `"apiBase": "https://ark.cn-beijing.volces.com/api/coding/v3"` in your volcengine provider config.
> - **Alibaba Cloud Coding Plan**: If you're on the Alibaba Cloud Coding Plan (BaiLian), set `"apiBase": "https://coding.dashscope.aliyuncs.com/v1"` in your dashscope provider config.

| 供应库服务商 | 服务用途 | 获取相关 Token 密钥路径 |
|------------|----------|-------------------------|
| `custom` | 接入任意 OpenAI API 标准兼容的端点直连通信（不经过 LiteLLM 中间件） | — |
| `openrouter` | 全模型大语言模型聚合网关 (强烈推荐) | [openrouter.ai](https://openrouter.ai) |
| `anthropic` | 专职调用 Claude 全系模型 | [console.anthropic.com](https://console.anthropic.com) |
| `azure_openai` | 微软 Azure 企业级 OpenAI 服务 | [portal.azure.com](https://portal.azure.com) |
| `openai` | 原生直连 ChatGPT 接口 | [platform.openai.com](https://platform.openai.com) |
| `deepseek` | 深度求索引擎官方接口 | [platform.deepseek.com](https://platform.deepseek.com) |
| `groq` | Groq LPU 加速卡大模型 + **超高速语音转文字解析** (Whisper) | [console.groq.com](https://console.groq.com) |
| `gemini` | Google 官方 Gemini 直连大模型 | [aistudio.google.com](https://aistudio.google.com) |
| `minimax` | 稀宇科技 Minimax 大模型直通 | [platform.minimaxi.com](https://platform.minimaxi.com) |
| `aihubmix` | AI大模型直连代理分发网关平台 | [aihubmix.com](https://aihubmix.com) |
| `siliconflow` | 硅基流动云端端点直通方案 | [siliconflow.cn](https://siliconflow.cn) |
| `volcengine` | 字节跳动火山引擎企业级网关直通 | [volcengine.com](https://www.volcengine.com) |
| `dashscope` | 阿里云百炼平台（通义千问模型系）直通网关 | [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com) |
| `moonshot` | 月之暗面 Kimi | [platform.moonshot.cn](https://platform.moonshot.cn) |
| `zhipu` | 智谱 AI 大模型平台直通 | [open.bigmodel.cn](https://open.bigmodel.cn) |
| `vllm` | 本地化托管或任意兼容 OpenAI 标准的本地加速服 | — |
| `openai_codex` | 第一代基于令牌机制的 Codex (要求 OAuth 登入) | 终端执行: `marketbot provider login openai-codex` |
| `github_copilot` | 跨域调取 GitHub Copilot 服务网络侧 | 终端执行: `marketbot provider login github-copilot` |

<details>
<summary><b>OpenAI Codex (OAuth)</b></summary>

Codex uses OAuth instead of API keys. Requires a ChatGPT Plus or Pro account.

**1. Login:**

```bash
marketbot provider login openai-codex
```

**2. Set model** (merge into `~/.marketbot/config.json`):

```json
{
  "agents": {
    "defaults": {
      "model": "openai-codex/gpt-5.1-codex"
    }
  }
}
```

**3. Chat:**

```bash
marketbot agent -m "Hello!"
```

> Docker users: use `docker run -it` for interactive OAuth login.

</details>

<details>
<summary><b>Custom Provider (Any OpenAI-compatible API)</b></summary>

Connects directly to any OpenAI-compatible endpoint — LM Studio, llama.cpp, Together AI, Fireworks, Azure OpenAI, or any self-hosted server. Bypasses LiteLLM; model name is passed as-is.

```json
{
  "providers": {
    "custom": {
      "apiKey": "your-api-key",
      "apiBase": "https://api.your-provider.com/v1"
    }
  },
  "agents": {
    "defaults": {
      "model": "your-model-name"
    }
  }
}
```

> For local servers that don't require a key, set `apiKey` to any non-empty string (e.g. `"no-key"`).

</details>

<details>
<summary><b>vLLM (local / OpenAI-compatible)</b></summary>

Run your own model with vLLM or any OpenAI-compatible server, then add to config:

**1. Start the server** (example):

```bash
vllm serve meta-llama/Llama-3.1-8B-Instruct --port 8000
```

**2. Add to config** (partial — merge into `~/.marketbot/config.json`):

*Provider (key can be any non-empty string for local):*

```json
{
  "providers": {
    "vllm": {
      "apiKey": "dummy",
      "apiBase": "http://localhost:8000/v1"
    }
  }
}
```

*Model:*

```json
{
  "agents": {
    "defaults": {
      "model": "meta-llama/Llama-3.1-8B-Instruct"
    }
  }
}
```

</details>

<details>
<summary><b>Adding a New Provider (Developer Guide)</b></summary>

marketbot uses a **Provider Registry** (`marketbot/providers/registry.py`) as the single source of truth.
新增某个大模型供应方接口只需要极致的 **2步** — 无需编写冗长肮脏的 if-else 链条。

**Step 1.** Add a `ProviderSpec` entry to `PROVIDERS` in `marketbot/providers/registry.py`:

```python
ProviderSpec(
    name="myprovider",                   # config field name
    keywords=("myprovider", "mymodel"),  # model-name keywords for auto-matching
    env_key="MYPROVIDER_API_KEY",        # env var for LiteLLM
    display_name="My Provider",          # shown in `marketbot status`
    litellm_prefix="myprovider",         # auto-prefix: model → myprovider/model
    skip_prefixes=("myprovider/",),      # don't double-prefix
)
```

**Step 2.** Add a field to `ProvidersConfig` in `marketbot/config/schema.py`:

```python
class ProvidersConfig(BaseModel):
    ...
    myprovider: ProviderConfig = ProviderConfig()
```

That's it! Environment variables, model prefixing, config matching, and `marketbot status` display will all work automatically.

**Common `ProviderSpec` options:**

| Field | Description | Example |
|-------|-------------|---------|
| `litellm_prefix` | Auto-prefix model names for LiteLLM | `"dashscope"` → `dashscope/qwen-max` |
| `skip_prefixes` | Don't prefix if model already starts with these | `("dashscope/", "openrouter/")` |
| `env_extras` | Additional env vars to set | `(("ZHIPUAI_API_KEY", "{api_key}"),)` |
| `model_overrides` | Per-model parameter overrides | `(("kimi-k2.5", {"temperature": 1.0}),)` |
| `is_gateway` | Can route any model (like OpenRouter) | `True` |
| `detect_by_key_prefix` | Detect gateway by API key prefix | `"sk-or-"` |
| `detect_by_base_keyword` | Detect gateway by API base URL | `"openrouter"` |
| `strip_model_prefix` | Strip existing prefix before re-prefixing | `True` (for AiHubMix) |

</details>

### MCP (模型上下文协议)

> [!TIP]
> 配置文件格式完全兼容 Claude Desktop / Cursor。您可以直接从任何 MCP 服务器的 README 中复制配置。

MarketBot 支持 [MCP](https://modelcontextprotocol.io/) — 您可以接入外部工具服务器并将其作为原生的 Agent 工具使用。

在您的 `config.json` 中添加 MCP 服务器:

```json
{
  "tools": {
    "mcpServers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
      },
      "my-remote-mcp": {
        "url": "https://example.com/mcp/",
        "headers": {
          "Authorization": "Bearer xxxxx"
        }
      }
    }
  }
}
```

支持两种传输模式:

| 模式 | 配置 | 示例 |
|------|--------|---------|
| **标准输入输出 (Stdio)** | `command` + `args` | 通过 `npx` / `uvx` 运行的本地进程 |
| **HTTP** | `url` + `headers` (可选) | 远程端点 (`https://mcp.example.com/sse`) |

使用 `toolTimeout` 来覆盖缓慢服务器默认的 30 秒单次调用超时限制:

```json
{
  "tools": {
    "mcpServers": {
      "my-slow-server": {
        "url": "https://example.com/mcp/",
        "toolTimeout": 120
      }
    }
  }
}
```

MCP 工具会在启动时被自动发现和注册。大模型（LLM）可以像调用内置工具一样顺畅地使用它们——无需任何额外配置。

### 🛡️ 安全

> [!TIP]
> 针对生产环境部署，请在配置文件中设置 `"restrictToWorkspace": true` 以将 Agent 沙盒化。
> **源码更新 / `v0.1.4.post3` 之后版本的重要提示:** 在早期版本中，空的 `allowFrom` 意味着“允许所有人访问”。在较新版本中（包括源码编译版），**默认情况下空的 `allowFrom` 会拒绝所有访问**。若要放开权限，请设置为 `"allowFrom": ["*"]`。

| 选项 | 默认值 | 描述 |
|--------|---------|-------------|
| `tools.restrictToWorkspace` | `false` | 设为 `true` 时，限制**所有**具备高危权限的工具（如 Shell、文件读写/修改、列表浏览）仅在 Workspace（工作区）目录内运行，有效防止路径穿越和越权访问。 |
| `tools.exec.pathAppend` | `""` | 运行 shell 命令时需要追加到 `PATH` 环境变量的额外目录（例如为 `ufw` 添加 `/usr/sbin`）。 |
| `channels.*.allowFrom` | `[]` (全部放行) | 允许交互的用户白名单体系。如果是 `["*"]` 则完全对外开放；如果非空，则只有列表内的合法用户能够与 Agent 交互。 |

## 🪟 多实例运行

由于其极致的轻量级特性，您可以同时运行多个 marketbot 实例组网，每个实例拥有独立的工作区和配置文件。

```bash
# Instance A - Telegram bot
marketbot gateway -w ~/.marketbot/botA -p 18791

# Instance B - Discord bot
marketbot gateway -w ~/.marketbot/botB -p 18792

# Instance C - Using custom config file
marketbot gateway -w ~/.marketbot/botC -c ~/.marketbot/botC/config.json -p 18793
```

| Option | Short | Description |
|--------|-------|-------------|
| `--workspace` | `-w` | Workspace directory (default: `~/.marketbot/workspace`) |
| `--config` | `-c` | Config file path (default: `~/.marketbot/config.json`) |
| `--port` | `-p` | Gateway port (default: `18790`) |

每一个独立的实例都拥有自己独占的:

- 工作区目录（持久化核心词典 `MEMORY.md`、主被动交互节拍器 `HEARTBEAT.md`、Session会话文件）
- 定时任务持久化存储库 (`workspace/cron/jobs.json`)
- 隔离环境配置文件（当附带 `--config` 参数时）

## ⌨️ 核心 CLI 指令参考

| Command | Description |
|---------|-------------|
| `marketbot onboard` | Initialize config & workspace |
| `marketbot agent -m "..."` | Chat with the agent |
| `marketbot agent` | Interactive chat mode |
| `marketbot agent --no-markdown` | Show plain-text replies |
| `marketbot agent --logs` | Show runtime logs during chat |
| `marketbot gateway` | Start the gateway |
| `marketbot status` | Show status |
| `marketbot provider login openai-codex` | OAuth login for providers |
| `marketbot channels login` | Link WhatsApp (scan QR) |
| `marketbot channels status` | Show channel status |

退出交互模式: 输入 `exit`, `quit`, `/exit`, `/quit`, `:q`, 或者使用 `Ctrl+D`。

<details>
<summary><b>Heartbeat (Periodic Tasks)</b></summary>

The gateway wakes up every 30 minutes and checks `HEARTBEAT.md` in your workspace (`~/.marketbot/workspace/HEARTBEAT.md`). If the file has tasks, the agent executes them and delivers results to your most recently active chat channel.

**Setup:** edit `~/.marketbot/workspace/HEARTBEAT.md` (created automatically by `marketbot onboard`):

```markdown
## Periodic Tasks

- [ ] Check weather forecast and send a summary
- [ ] Scan inbox for urgent emails
```

The agent can also manage this file itself — ask it to "add a periodic task" and it will update `HEARTBEAT.md` for you.

> **Note:** The gateway must be running (`marketbot gateway`) and you must have chatted with the bot at least once so it knows which channel to deliver to.

</details>

## 🐳 Docker 部署

> [!TIP]
> 通过传入 `-v ~/.marketbot:/root/.marketbot` 标志将您本地的配置文件夹挂载到容器内部，以便于配置和核心工作流 (Workspace) 能够实现数据的长久留存而不受容器重启的影响。

### Docker Compose (推荐编排)

```bash
docker compose run --rm marketbot-cli onboard   # 首次使用进行初始化操作
vim ~/.marketbot/config.json                     # 填入或附加必需的 API Key
docker compose up -d marketbot-gateway           # 后台挂起网关
```

```bash
docker compose run --rm marketbot-cli agent -m "Hello!"   # 运行对话式命令行交互
docker compose logs -f marketbot-gateway                   # 持续跟踪打印系统最新日志
docker compose down                                      # 关闭所有服务
```

### Docker

```bash
# 开始构建镜像
docker build -t marketbot .

# 初始化配置参数（仅首次运行需要）
docker run -v ~/.marketbot:/root/.marketbot --rm marketbot onboard

# Edit config on host to 填入或附加必需的 API Key
vim ~/.marketbot/config.json

# 启动网关主进程 (将开启所有已启用的即时通讯监听通道，如 TG/Discord/Mochat)
docker run -v ~/.marketbot:/root/.marketbot -p 18790:18790 marketbot gateway

# 快速单列直接发号施令
docker run -v ~/.marketbot:/root/.marketbot --rm marketbot agent -m "Hello!"
docker run -v ~/.marketbot:/root/.marketbot --rm marketbot status
```

## 🐧 Linux SystemD 服务化托管

将网关系列命令固化为一个 Systemd 的用户级别服务，藉此获得开机自启崩溃自动拉起的完整后台服务生命周期属性。

**1. 定位并寻找 marketbot 核心二进制可执行程序的路径:**

```bash
which marketbot   # e.g. /home/user/.local/bin/marketbot
```

**2. 编写并植入专属服务描述文件** 位于路径 `~/.config/systemd/user/marketbot-gateway.service` (根据需要手动替换 `ExecStart` 执行路径):

```ini
[Unit]
Description=Marketbot Gateway
After=network.target

[Service]
Type=simple
ExecStart=%h/.local/bin/marketbot gateway
Restart=always
RestartSec=10
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=%h

[Install]
WantedBy=default.target
```

**3. 正式启动并载入系统守护:**

```bash
systemctl --user daemon-reload
systemctl --user enable --now marketbot-gateway
```

**日常高频操作指南:**

```bash
systemctl --user status marketbot-gateway        # 检查目前存活状态
systemctl --user restart marketbot-gateway       # 应用最新的配置选项，重启引擎服务
journalctl --user -u marketbot-gateway -f        # 直接查看追溯该守护服务所产生的日志输出流
```

如果您自主编辑更新了该 `.service` 描述文件本身，请在重启进程之前重新下达加载守护单元的命令：`systemctl --user daemon-reload`。

> **极客提示:** 默认体系之下用户级别的守护服务仅限于当前终端已登入的存续期间运作。如果要求此后台监控大网关即使是在远程 SSH 脱离的情况下也时刻长守运行不掉线，敬请打通下设的永续授权层:
>
> ```bash
> loginctl enable-linger $USER
> ```

## 📁 项层代码结构总览

```
marketbot/
├── agent/          # 🧠 Core agent logic
│   ├── loop.py     #    Agent loop (LLM ↔ tool execution)
│   ├── context.py  #    Prompt builder
│   ├── memory.py   #    Persistent memory
│   ├── skills.py   #    Skills loader
│   ├── subagent.py #    Background task execution
│   └── tools/      #    Built-in tools (incl. spawn)
├── skills/         # 🎯 Bundled skills (market-discovery, portfolio-analyzer, sentiment-analysis...)
├── channels/       # 📱 Chat channel integrations
├── bus/            # 🚌 Message routing
├── cron/           # ⏰ Scheduled tasks
├── heartbeat/      # 💓 Proactive wake-up
├── providers/      # 🐂 LLM providers (OpenRouter, etc.)
├── session/        # 💬 Conversation sessions
├── config/         # ⚙️ Configuration
└── cli/            # 🖥️ Commands
```

## 🤝 开发规划与开源协同

强烈推荐并发起各大 PR（代码合入申请）！该套架构的基因本就决定了它必定且持久地处于纯净轻量的可读代码范畴之中。 🤗

**Roadmap 跃进版图** — 挑选一项你力所能及的挑战并向我们 [发起 PR 申请交收](https://github.com/HKUDS/marketbot/pulls) 吧！

- [ ] **多模态加持网络** — 获得对图像/语音甚至流视频的读图及聆听共情能力
- [ ] **深度长效时序记忆** — 对于时间轴或事件强关联锚点实现永恒不遗忘
- [ ] **超级推理决策引擎升级** — 自驱动包含着发散思维反馈再校准体系
- [ ] **无尽的终端硬件映射集成** — 把你的电脑日历应用或闹钟甚至是车载控制流接进来
- [ ] **终极 AI Agent 自主自进化纠错链条体系** — 在犯错边缘完成极限收敛并学习优化自省逻辑

### 我们最硬核的联合代码架构开源贡献者们

<a href="https://github.com/HKUDS/marketbot/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=HKUDS/marketbot&max=100&columns=12&updated=20260210" alt="Contributors" />
</a>

<p align="center">
  <em> Thanks for visiting ✨ marketbot!</em><br><br>
  <img src="https://visitor-badge.laobi.icu/badge?page_id=HKUDS.marketbot&style=for-the-badge&color=00d4ff" alt="Views">
</p>

<p align="center">
  <sub>marketbot 仅仅作代码逻辑教学、人工智能多模态课题验证突破研究、学术分享和最高规格技术交流研讨演示之用，不具备及绝不作任何具备任何隐晦金线暗示及导向交易承诺引导效力</sub>
</p>
