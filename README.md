<div align="center">
  <img src="marketbot_logo.png" alt="marketbot" width="420">
  <h1>marketbot</h1>
  <p><strong>一个以 skill 为核心、面向金融分析的轻量级 AI 助手。</strong></p>
  <p><strong><a href="README_en.md">English</a> | 中文</strong></p>
</div>

`marketbot` 是一个面向金融分析场景的 agent runtime。它保留了通用聊天 agent 的灵活性，但把金融工作拆成了清晰可维护的几层：

- 上层用 `skill` 编排分析任务
- 中层用统一的市场领域服务处理 `quote / news / macro`
- 输出层携带 `skill routing`、`data reliability`、`source health`、`route trace`
- 运行时支持 `skill scoring`、`fallback routing` 和同轮失败重试
- 结果可以发到 CLI、周期性任务和多种聊天渠道

## 你可以用它做什么

- 针对一组标的生成市场简报
- 给持仓生成热点事件和催化监控清单
- 做 watchlist 的日常监控、筛选和周期性报告
- 按市场、资产类别、freshness、工具可用性自动选择 skill
- 在相近 skill 间按历史成功率和场景化动态分自动排序
- 当首选 skill 明显失败时，自动回退到兼容的 fallback skill 再执行一次
- 把结果推送到聊天渠道，并保留可靠性说明
- 在需要时快速修改数据路由、skill 和输出逻辑

## 为什么不是普通聊天机器人

- `skill-first`
  金融分析不是一段大 prompt。每个 skill 都可以声明触发条件、输出形态、风险级别、时效要求、市场覆盖、资产类别和依赖工具。
- `领域层独立`
  quote、news、macro 走共享的 market domain services，而不是散落在每个 tool 里的抓取逻辑。
- `输出可解释`
  聊天回复、报告和通知都可以带上 skill routing、blocked reasons、source health、data reliability 和 fallback execution。
- `runtime 很薄`
  runtime 主要负责消息处理、并发、会话、tool 执行和渠道发送，不把金融逻辑塞进主循环。
- `适合长期演化`
  同一套能力可以服务 CLI、定时任务、报告存档和多渠道推送。

## 最短上手路径

```bash
python3 -m venv .venv313
source .venv313/bin/activate
python -m pip install -e .
marketbot onboard
marketbot agent
marketbot agent -m "给我 NVDA、07709、513310 的最新价格"
marketbot agent -m "根据我的持仓生成未来两周的热点事件监控清单：NVDA,UNH,07709,07747,513310,518880"
```

## 核心概念

| 层 | 位置 | 负责什么 |
| --- | --- | --- |
| `Skills` | `marketbot/skills/*/SKILL.md` | 高层任务编排，决定何时触发、适合什么市场、依赖哪些工具、输出长什么样 |
| `Market Domain` | `marketbot/domain/market/` | 标准化的 `quote / news / macro` 访问，外加 cache、source health、route trace、runtime profile |
| `Tools` | `marketbot/agent/tools/market.py` 等 | 原子能力层，例如 `market_snapshot`、`market_news`、`market_macro`、`market_brief` |
| `Reporting / Delivery` | `marketbot/market_reporting.py`、`marketbot/channels/*` | 把结构化结果渲染成 CLI 回复、保存报告、通知摘要和渠道消息 |

## 运行时设计架构

当前 `marketbot` 不是单一的大 prompt 循环，而是一个分层的 agent runtime：

1. `Channels / CLI / Cron / Heartbeat`
   负责把外部输入送进统一消息总线；聊天渠道回包也走同一套 outbound bus。
2. `Session + Context`
   `session` 负责 JSONL 持久化，`context` 负责拼装历史、memory、skills、runtime metadata。
3. `Router`
   先把请求分类成 `direct_react`、`planned_task`、`market_fast_path`、`scheduled_task`。
4. `Planner`
   对复杂任务生成结构化 plan，把任务拆成若干 step，并为每一步限制 `allowed_tools`。
5. `Executor`
   保留 ReAct 式工具调用循环，但执行范围被限制在当前 step，避免工具无边界漫游。
6. `Verifier + Plan Runtime`
   判断 step 是否完成、是否需要 retry / replan，并把计划状态推进和落盘。
7. `Reporting / Delivery`
   把最终结果渲染成 CLI 回复、保存报告、通知摘要或聊天消息。

可以把主路径理解成：

`Inbound -> MessageBus -> AgentLoop -> Router -> (Planner) -> Step Executor(ReAct) -> Verifier -> Outbound`

对应代码位置：

- `marketbot/agent/loop.py`
- `marketbot/agent/router.py`
- `marketbot/agent/planner.py`
- `marketbot/agent/executor.py`
- `marketbot/agent/verifier.py`
- `marketbot/agent/plan_runtime.py`
- `marketbot/channels/*`

### 为什么是 Planning + Bounded ReAct

- 简单问题继续直接走 ReAct，保证 CLI 和聊天场景的响应速度
- 复杂任务先做 planning，再做 step-scoped execution，降低长链路工具调用的漂移
- tool health 会在 prompt 暴露前先过滤掉不健康工具，避免模型频繁调用半坏工具
- `subagent` 也对齐了同一套 route / plan / verify 逻辑，减少主从执行路径漂移

### 与旧式单环 ReAct 的区别

- 不是所有请求都直接丢进一个大 loop
- 复杂任务不再完全依赖模型自己决定“下一步做什么”
- 工具不再默认全量暴露，而是按健康状态和 step 白名单收缩
- plan 会写到 `workspace/plans/*.json`，便于恢复、调试和审计

### 渠道与 Gateway

- `marketbot agent` 只负责本地 CLI 交互
- `marketbot gateway` 才会启动 `channels.* + outbound dispatcher + agent loop`
- 飞书 / Telegram / Slack / Discord 等聊天渠道必须依赖 `gateway` 常驻运行
- 对飞书来说，当前实现使用 WebSocket 长连接，不需要公网 webhook，但必须保持 `gateway` 进程在线

常见内置 skill：

| Skill | 作用 |
| --- | --- |
| `market-report` | 对标的或 watchlist 生成市场简报 |
| `market-monitor` | 做持续监控和观察 |
| `market-discovery` | 做机会扫描和主题发现 |
| `news-intelligence` | 做新闻事件提取与冲击分析 |
| `sentiment-analysis` | 做新闻和社交情绪整合 |
| `thesis-tracker` | 跟踪一个观点在新证据下是 strengthened、weakened 还是 falsified |
| `logic-chain-visualizer` | 把事件传导、产业链影响和逻辑链输出成 Markdown + Mermaid |
| `portfolio-analyzer` | 做组合层面的风险与结构分析 |
| `daily-stock-screener` | 对每日股票列表做估值、趋势、量能和情绪筛选排序 |
| `catalyst-tracker` | 做催化剂跟踪 |
| `stock-watch` | 对指定标的做监控和摘要 |
| `risk-checklist` | 输出风险清单 |
| `ak-rss-digest` | 从固定 RSS 源生成偏 AI 和技术主题的中文阅读摘要 |
| `tech-news-digest` | 从分层信源目录生成 AI 与技术新闻日报 |
| `intel-collector` | 管理 RSS/资讯源、执行采集并建立定时采集任务 |
| `intel-daily-digest` | 从已采集的情报条目生成日报并建立定时摘要任务 |

## 5 分钟上手

### 1. 安装

```bash
git clone https://github.com/EthanAlgoX/MarketBot.git
cd MarketBot
python3 -m venv .venv313
source .venv313/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
```

如果需要 Matrix：

```bash
python -m pip install -e ".[matrix]"
```

如果是开发环境：

```bash
python -m pip install -e ".[dev]"
```

说明：

- 推荐始终在虚拟环境中执行 `marketbot` 命令
- 如果你的机器上没有 `pip` 命令，直接使用 `python -m pip ...`
- 项目要求 Python `>= 3.11`

### 2. 初始化配置

```bash
marketbot onboard
```

这会创建默认工作区和 `~/.marketbot/config.json`。

### 3. 配置模型和市场工具

最小配置示例：

```json
{
  "providers": {
    "openrouter": {
      "apiKey": "sk-or-v1-xxx"
    }
  },
  "agents": {
    "defaults": {
      "provider": "openrouter",
      "model": "anthropic/claude-opus-4-1"
    }
  },
  "tools": {
    "market": {
      "quoteSource": "tickflow",
      "tickflowApiKey": "tk-xxx",
      "newsSources": ["reuters", "bloomberg", "cls"],
      "macroSource": "fred",
      "cacheTtlS": 60
    }
  },
  "channels": {
    "explainabilityMode": "auto",
    "explainabilityDelivery": "auto"
  }
}
```

说明：

- `quoteSource: tickflow` 适合以 A 股实时数据为主的工作流；混合市场再考虑 `auto`
- `tickflowApiKey` 用于 TickFlow 实时行情和基础面接口
- `newsSources` 决定新闻路由顺序
- `macroSource: fred` 需要 FRED API key；没有 key 时会明确降级
- `explainabilityMode` 控制是否在结果里带能力和可靠性说明

可选：如果你希望 agent 直接操作飞书/Lark 文档、消息、表格、任务，可以额外开启本地 `lark-cli` 工具层：

```json
{
  "tools": {
    "larkCli": {
      "enabled": true,
      "command": "lark-cli",
      "timeoutS": 45,
      "configDir": "~/.lark-cli",
      "allowWrite": false,
      "allowAuth": false
    }
  }
}
```

说明：

- `allowWrite: false` 时只允许查询类操作，默认阻止发消息、创建文档、写表格、改任务
- `allowAuth: false` 时禁止 agent 触发 `lark-cli auth ...`
- 启用后，agent 会获得 `lark_cli`、`lark_im`、`lark_doc`、`lark_sheets`、`lark_task`、`lark_base` 这些工具
- 这层集成补的是飞书办公能力，不替代现有 `channels.feishu` 消息通道
- 下面有单独的 `Lark CLI 集成` 章节，包含安装、授权、`marketbot status` 校验和使用示例

可选：如果你希望 agent 原生分析 Twitter/X 讨论、线程和账号动态，可以额外开启本地 `twitter-cli` 工具层：

```json
{
  "tools": {
    "twitterCli": {
      "enabled": true,
      "command": "twitter",
      "timeoutS": 45,
      "browser": "chrome",
      "chromeProfile": "Profile 2",
      "homeDir": "~/.marketbot",
      "allowWrite": false
    }
  }
}
```

说明：

- `browser` / `chromeProfile` 用于把 CLI cookie 读取绑定到指定浏览器和 Profile
- `homeDir` 建议单独指定一个可写目录，用来隔离 `twitter-cli` 的本地状态
- `allowWrite: false` 时只开放查询类 Twitter/X 操作；发帖、回复、引用、点赞、转推、关注等写操作默认关闭
- 启用后，agent 会获得 `twitter_cli` 工具，并让 `twitter-browser-research` skill 优先走 CLI 而不是 `browser_site`
- 下面有单独的 `Twitter CLI 集成` 章节，包含安装、登录、`marketbot status` 校验和使用示例

### 4. 直接开始用

最常用的 4 条命令：

```bash
source .venv313/bin/activate
marketbot agent
marketbot agent -m "给我 NVDA、07709、513310 的最新价格"
marketbot agent -m "根据我的持仓生成未来两周的热点事件监控清单：NVDA,UNH,07709,07747,513310,518880"
marketbot market report --symbols NVDA,SPY --save
```

补充：

- `marketbot market report --json`：输出原始结构化结果
- `marketbot market report --session premarket|intraday|close`
- `marketbot market report --notify --notify-channel telegram --chat-id 10001`
- `marketbot market heartbeat-setup`：生成周期性报告模板
- `marketbot skills score show`：查看 skill 动态评分 buckets
- `marketbot skills score reset --skill xueqiu-research`：重置某个 skill 的评分
- `marketbot skills score reset --all`：清空全部 skill 评分

如果你要接飞书、Telegram、Slack、Discord 等渠道，不是启动 `marketbot agent`，而是启动：

```bash
source .venv313/bin/activate
marketbot gateway
```

`agent` 只负责本地 CLI 对话；渠道消息接收和回包由 `gateway` 负责。

## 常见错误

### 1. `zsh: command not found: pip`

原因：系统里没有暴露 `pip` 命令，或当前 shell 没有激活虚拟环境。

处理方式：

```bash
python3 -m venv .venv313
source .venv313/bin/activate
python -m pip install --upgrade pip
python -m pip install -e .
```

### 2. `error: externally-managed-environment`

原因：macOS / Homebrew Python 默认不允许直接往系统环境安装包（PEP 668）。

处理方式：不要使用系统 Python 直接 `pip install -e .`，改用虚拟环境：

```bash
python3 -m venv .venv313
source .venv313/bin/activate
python -m pip install -e .
```

### 3. 飞书发消息后没有回复

常见原因：只启动了 `marketbot agent`，没有启动 `marketbot gateway`。

正确方式：

```bash
source .venv313/bin/activate
marketbot gateway
```

排查顺序：

- 先执行 `marketbot status`，确认 `channels.feishu.enabled = true`
- 确认配置文件 `~/.marketbot/config.json` 里已经填写 `appId` 和 `appSecret`
- 保持 `marketbot gateway` 进程持续运行，不要只开 `marketbot agent`
- 如果 `allowFrom` 为空，飞书消息会被拒绝；调试时可先设为 `["*"]`

### 4. `PermissionError` 或会话文件写入失败

原因：`marketbot` 默认会把会话、cron 和工作区文件写到 `~/.marketbot/workspace/`。

处理方式：

- 确认当前用户对 `~/.marketbot/` 有写权限
- 不要在只读沙箱环境里直接运行需要落盘的 `marketbot` 进程
- 必要时先执行 `marketbot onboard` 重新初始化默认目录

## 常见使用场景

```bash
marketbot agent -m "根据我的持仓生成今天盘前监控清单：SPY,NVDA,GOOG,TSLA,UNH,07709,513310"
marketbot agent -m "列出 NVDA、UNH、07709 未来两周最重要的催化和风险"
marketbot agent -m "筛选今天值得重点看的股票：NVDA,TSLA,INTC,TTD,CRWV"
marketbot agent -m "为什么 07709 走这个价格源？给我看数据路由和可靠性"
marketbot agent -m "请生成一份 AI 日报，从固定 RSS 里整理阅读摘要"
marketbot agent -m "生成今天的技术新闻日报，重点看 AI 和开发者工具"
```

## Skill Routing 与 Fallback

`marketbot` 的 skill 选择不是纯 prompt 匹配，而是三层组合：

- 静态匹配：按 `triggers`、`required_tools`、`markets`、`asset_classes`、`freshness`
- 动态评分：按 `(skill, market, task_type, toolset_signature)` 分桶累计成功和失败
- fallback 执行：首选 skill 明显失败时，按 metadata 声明的 `fallback_skills` 同轮重试一次

当前已接入的高价值 fallback 场景包括：

- `eastmoney-live -> news-intelligence`
- `xueqiu-research -> social-signal-browser, sentiment-analysis`
- `browser-news-verifier -> news-intelligence`

评分结果持久化到 workspace：

```text
~/.marketbot/workspace/data/skill_scores.json
```

你可以直接查看或重置它：

```bash
marketbot skills score show
marketbot skills score show --skill xueqiu-research --json
marketbot skills score reset --skill xueqiu-research
marketbot skills score reset --all
```

当发生 fallback 时，输出 metadata 和 explainability 会显式带上：

- `skill_routing.fallbackExecution`
- `skill_fallback`
- `Fallback: primary->selectedFallback`

这意味着你可以直接排查：

- 哪个主 skill 经常失败
- 哪个 fallback skill 实际接管了结果
- 哪些 buckets 的动态分已经偏低，需要 reset 或继续观察

## 最近新增的金融能力

最近一轮从 `Awesome-finance-skills` 方向落地的能力主要有：

- `intel_search`
  对 workspace 已采集情报做本地 BM25 检索，用于 prior-news recall 和 thesis 跟踪
- 可插拔情绪后端
  `market_event_extract` 和 `market_social_sentiment` 支持 `tools.market.sentimentBackend`
- `thesis-tracker`
  支持 thesis 的 `create / get / list / update`，并自动判断观点被强化、削弱还是证伪
- `logic-chain-visualizer`
  输出事件传导链和逻辑链图
- `market_brief` 闭环增强
  可附带历史 intel、logic chain appendix，并直接创建或更新 thesis

## 技术资讯 Skill

除了市场分析链路，当前也内置了三类技术资讯能力：

- `ak-rss-digest`
  使用固定 RSS/Atom 信源和脚本抓取，适合做偏 AI agent、前沿 AI、深度访谈的中文阅读摘要。
- `tech-news-digest`
  使用分层信源目录做技术和 AI 新闻汇总，优先抓取 `tier1`，不足时再扩到 `tier2`，浏览器型来源作为可选增强。
- `intel-collector` / `intel-daily-digest`
  提供可持久化的 RSS/资讯源管理、采集、digest 生成和 cron 调度，适合把资讯流接成可重复运行的情报管线。

典型调用：

```bash
marketbot agent -m "请生成一份 AI 日报，从固定 RSS 里整理阅读摘要"
marketbot agent -m "生成今天的技术新闻日报，重点看 AI、模型产品和开发者工具"
```

如果你希望把 RSS/资讯源采集和日报生成接入定时任务，推荐使用 `intel` 命令链路：

```bash
marketbot intel source-add --type rss --name "OpenAI Blog" --url https://openai.com/blog/rss.xml
marketbot intel collect
marketbot intel digest-daily
marketbot intel digest-list
marketbot intel digest-show 1
marketbot intel schedule-latest-daily --collect-cron-expr "55 7 * * *" --digest-cron-expr "0 8 * * *" --tz Asia/Shanghai
marketbot intel schedule-list
marketbot intel schedule-remove <job-id>
```

其中 `schedule-latest-daily` 会一次创建两个 cron job：

- 上游 `intel_collect`，先刷新 source
- 下游 `intel_digest_daily`，再基于最新条目生成日报

## 可解释性与可靠性

这是 `marketbot` 和普通聊天 agent 最不一样的一层。

系统可以暴露的关键信息：

| 字段 | 说明 |
| --- | --- |
| `skill routing` | 这轮选中了哪些 skill |
| `blocked reasons` | 哪些 skill 没被选中，以及为什么 |
| `data reliability` | `snapshot / news / macro` 的总体可靠性 |
| `source health` | 每个 provider 当前是 `ok`、`cached`、`degraded`、`fallback` 还是 `error` |
| `route trace` | 数据访问链路是如何路由和降级的 |

这些信息会进入：

- chat 回复
- 保存的 market report
- 通知摘要
- outbound metadata

相关配置：

- `channels.explainabilityMode`
- `channels.explainabilityOverrides`
- `channels.explainabilityDelivery`
- `channels.explainabilityDeliveryOverrides`

## 渠道支持

| 渠道 | 说明 |
| --- | --- |
| Telegram | 基于 `python-telegram-bot` |
| Slack | Socket mode |
| Discord | REST + gateway |
| 飞书 | 文本、post、card 风格 |
| 钉钉 | Stream mode |
| Email | IMAP + SMTP |
| WhatsApp | 通过桥接服务集成 |
| QQ | Bot 集成 |
| Mochat | Socket.IO + HTTP |
| Matrix | 可选依赖 |

常用命令：

```bash
marketbot gateway
marketbot status
marketbot channels --help
marketbot provider --help
marketbot skills --help
```

## Browser 集成

如果要启用 `bb-browser`，建议先从保守配置开始：

```json
{
  "tools": {
    "browser": {
      "enabled": true,
      "command": "bb-browser",
      "mode": "safe",
      "adapterCatalog": ["xueqiu/hot-stock", "reddit/search", "youtube/search", "zhihu/hot", "yahoo-finance/quote", "wikipedia/summary"],
      "allowSites": ["xueqiu", "reddit", "youtube", "zhihu", "yahoo-finance", "wikipedia"],
      "allowDomains": ["xueqiu.com", "reddit.com", "youtube.com", "zhihu.com", "finance.yahoo.com", "wikipedia.org"],
      "allowUrlPrefixes": ["https://www.youtube.com/watch?v=", "https://en.wikipedia.org/wiki/"],
      "allowEval": false,
      "allowRequestCapture": false,
      "allowRequestBodies": false
    }
  }
}
```

关键点：

- `safe` 只允许只读浏览动作
- `adapterCatalog` 会作为 `browser_site` 的实际执行白名单；配置后只允许 catalog 中的 `<site>/<command>`
- `allowSites` / `allowAdapters` 仍可作为补充约束；未配置 `adapterCatalog` 时才是主要边界
- `allowDomains` / `allowUrlPrefixes` 用来约束 `browser_page(open)` 和 `browser_network(fetch)`
- `allowEval` 默认建议关闭，只有明确需要页面脚本求值时再打开
- `allowRequestCapture` 与 `allowRequestBodies` 默认建议关闭

## Lark CLI 集成

如果你希望 agent 直接读取或操作飞书/Lark 的消息、文档、表格、任务、多维表格，可以把本地 [`lark-cli`](https://github.com/larksuite/cli) 接到 MarketBot。当前推荐方式是：

1. 先在本机把 `lark-cli` 配好并确认单独可用
2. 再把它挂到 `tools.larkCli`
3. 最后用 `marketbot status` 和一条真实 agent 请求验证

这条集成的定位是“飞书办公执行层”，不替代 `channels.feishu` 的消息收发通道。

### 1. 安装 `lark-cli`

先确认本机有可执行的 `lark-cli` 命令。你可以自行选择安装方式，但对 MarketBot 来说最重要的是两点：

- `marketbot` 运行时必须能找到这个命令
- 最好把 `command` 配成绝对路径，避免 PATH 差异

例如：

```json
{
  "tools": {
    "larkCli": {
      "enabled": true,
      "command": "/absolute/path/to/lark-cli",
      "timeoutS": 45,
      "configDir": "~/.lark-cli",
      "allowWrite": false,
      "allowAuth": false
    }
  }
}
```

建议：

- `command` 优先写绝对路径，不要依赖 shell PATH
- `configDir` 推荐显式指定，例如 `~/.lark-cli`
- 初次接入时先保持 `allowWrite=false`
- 初次接入时先保持 `allowAuth=false`

### 2. 初始化 `lark-cli`

先单独完成 CLI 初始化和登录，不要一开始就让 agent 代替你走授权流程。

```bash
lark-cli config init --new
lark-cli auth login
```

说明：

- `config init --new` 会创建 `~/.lark-cli/config.json` 一类的本地配置
- `auth login` 通常会进入浏览器或 device-code 授权流程
- macOS 上如果 CLI 使用系统钥匙串，终端里可能会弹出 Keychain 访问确认

完成后先做最小自检：

```bash
lark-cli auth status
lark-cli doctor
lark-cli contact +get-user
```

如果这三条都正常，再接 MarketBot。

### 3. 配置 MarketBot

在 `~/.marketbot/config.json` 中加入：

```json
{
  "tools": {
    "larkCli": {
      "enabled": true,
      "command": "/absolute/path/to/lark-cli",
      "timeoutS": 45,
      "configDir": "~/.lark-cli",
      "allowWrite": false,
      "allowAuth": false
    }
  }
}
```

字段说明：

- `enabled`: 是否启用 `lark-cli` 工具层
- `command`: `lark-cli` 可执行文件路径；推荐绝对路径
- `timeoutS`: 单次命令超时，默认 `45`
- `configDir`: `lark-cli` 配置目录；如果 CLI 已经在别处初始化，要和真实目录保持一致
- `allowWrite`: 是否允许写操作；关闭时会阻止发消息、建文档、写表格、改任务等
- `allowAuth`: 是否允许 agent 触发 `auth` 流程；通常建议关闭

### 4. 用 `marketbot status` 验证接入

配置后先不要直接问复杂问题，先看运行态：

```bash
marketbot status
```

你应该能在输出里看到类似信息：

- `Lark CLI: ✓`
- `Lark CLI command: /absolute/path/to/lark-cli`
- `Lark CLI configDir: ~/.lark-cli`
- `Lark CLI writes: disabled`
- `Lark CLI auth: disabled`

如果看到 `command not found`，优先检查：

- `tools.larkCli.command` 是否写成了错误路径
- 该路径下的 `lark-cli` 是否有执行权限
- 你配置的 `configDir` 是否真的是 CLI 在使用的目录

### 5. Agent 会获得哪些工具

启用后，运行时会注册这些工具：

- `lark_cli`: 通用兜底入口，适合少量结构化工具暂未覆盖的只读查询
- `lark_im`: 飞书消息、群聊搜索与读取
- `lark_doc`: 飞书文档搜索与读取
- `lark_sheets`: 普通电子表格读取
- `lark_task`: 任务读取与更新
- `lark_base`: 多维表格 / Base / Bitable 的表、字段、记录读取

建议：

- 优先让 agent 使用 `lark_im`、`lark_doc`、`lark_sheets`、`lark_task`、`lark_base`
- `lark_cli` 只作为兜底
- 如果资源本质上是多维表格，不要走 `lark_sheets`，而要走 `lark_base`

### 6. 支持的典型场景

当前比较稳定的只读链路包括：

- 搜索飞书文档
- 搜索群聊和消息
- 读取普通电子表格
- 读取我的任务
- 读取多维表格的表名、字段、记录

在 Base/Bitable 场景下，当前已支持：

- `table_list`
- `field_list`
- `record_list`
- `record_get`
- `record_list` 指定 `fields`
- `record_list` 按 `field_filters` 做简单过滤或 DSL 过滤
- `table_name -> table_id` 自动解析

### 7. 示例请求

先验证 CLI 自身：

```bash
lark-cli docs +search --query 市场 --format json
lark-cli im +chat-search --query 市场 --format json
lark-cli base +table-list --base-token YOUR_BASE_TOKEN --format json
```

再验证 MarketBot：

```bash
marketbot agent -m "帮我搜索飞书里标题包含市场的文档，只返回前 3 条。"
marketbot agent -m "查一下飞书里和市场相关的群聊。"
marketbot agent -m "列出飞书 Base XdkhbJehDazQKtscNpLchLXSnac 的所有表名。"
marketbot agent -m "读取飞书 Base XdkhbJehDazQKtscNpLchLXSnac 中名为需求调研的表，返回前 2 条记录的 编号、AI 情感打标、您的年龄范围？ 三列。"
marketbot agent -m "读取飞书 Base XdkhbJehDazQKtscNpLchLXSnac 中名为需求调研的表，只返回 AI 情感打标 为 负向 的记录。"
```

### 8. Base / Bitable 使用建议

飞书里“普通电子表格”和“多维表格”是两套资源，不要混用：

- 普通电子表格：走 `lark_sheets`
- 多维表格 / Base / Bitable：走 `lark_base`

如果你已经知道 `base_token`，现在可以直接按表名读取，不一定要先手动查 `table_id`。如果表名有歧义，工具会返回结构化候选表名，方便 agent 继续澄清。

### 9. 安全边界

默认安全策略是偏保守的：

- 默认禁用写操作
- 默认禁用 `auth`
- 阻止长时间运行的事件订阅类命令
- 阻止直接输出到本地文件的危险参数
- 对明确的飞书办公请求，运行时会优先使用结构化 `lark_*` 工具，而不是回退到 `exec`

如果你确实要让 agent 写飞书内容，再显式打开：

```json
{
  "tools": {
    "larkCli": {
      "allowWrite": true
    }
  }
}
```

建议只在受控环境里打开，并先验证最小操作范围。

### 10. 常见问题

- `marketbot status` 里显示 `Lark CLI: disabled`
  原因：`tools.larkCli.enabled` 没开。

- `marketbot status` 里显示 `command not found`
  原因：`command` 路径错误，或者 CLI 不在 PATH。

- `lark-cli auth status` 在某些受限运行环境里报错
  原因：CLI 可能依赖本机钥匙串或系统凭据；先在你自己的终端确认 CLI 单独可用。

- 文档或表格能在飞书里打开，但工具返回权限错误
  原因：通常是缺 scope。先给 `lark-cli` 补对应权限，再回来验证 MarketBot。

- 一个资源看起来像表格，但 `lark_sheets` 读不出来
  原因：它可能其实是 Bitable；改走 `lark_base`。

## Xiaohongshu CLI 集成

如果本机已经安装 [`xiaohongshu-cli`](https://github.com/jackwener/xiaohongshu-cli)，可以把它作为只读工具接入给 agent 使用。当前推荐流程是：先在本机确认 `xhs` 可登录、可查询，再把它挂到 MarketBot。

### 1. 安装与登录

先在你自己的 Python 环境里安装 `xiaohongshu-cli`，并确认 `xhs` 命令可执行。然后完成一次登录：

```bash
xhs login
# 或
xhs login --qrcode
```

如果使用浏览器 cookie 登录，macOS 可能会弹出钥匙串访问确认；这里输入的是当前 macOS 账户的登录密码，不是小红书密码。

### 2. 配置 MarketBot

在 `~/.marketbot/config.json` 中加入：

```json
{
  "tools": {
    "xiaohongshuCli": {
      "enabled": true,
      "command": "xhs",
      "timeoutS": 45,
      "cookieSource": "auto",
      "homeDir": "~/.marketbot",
      "allowWrite": false
    }
  }
}
```

建议：

- `command` 最好写成绝对路径，例如 `"/Users/you/project/.venv/bin/xhs"`，避免 PATH 差异导致运行时找不到命令
- `homeDir` 建议单独指定一个可写目录，用来隔离 `xiaohongshu-cli` 的 cookie 和缓存
- `allowWrite` 保持 `false`

### 3. 验证链路

先验证 CLI 自身：

```bash
xhs status --json
xhs search "瑞幸咖啡" --sort popular --json
```

如果上面正常，再验证 MarketBot：

```bash
marketbot agent -m "用小红书分析瑞幸咖啡最近的热度、用户讨论重点和整体情绪，只给我简明结论。"
```

### 4. 运行时行为

- 默认按只读模式设计，当前接入只开放 `status / search / read / comments / feed / hot / topics / search-user / user / user-posts`
- 当 `tools.xiaohongshuCli.allowWrite=true` 时，额外支持受控 `post`，用于发布图片笔记
- 现有 `xiaohongshu-browser-research` skill 会优先使用 `xiaohongshu_cli`，缺失时再回退到 `browser_site`
- 在默认品牌分析请求下，运行时会优先走 `search(popular)`，必要时再补一轮 `search(latest)`，不会再优先走 `exec`、本地缓存文件或浏览器抓取旁路
- `xiaohongshu_cli` 会先把搜索结果压缩成适合模型消费的摘要，而不是把整块大 JSON 直接塞回上下文
- `homeDir` 可选；配置后会把 CLI 的 `HOME` 指向该目录，适合把 `xiaohongshu-cli` 的 cookie/cache 隔离到专用位置

### 5. 边界与风险

- 适合做品牌热度、消费叙事、笔记评论、用户内容等研究，不适合作为交易事实或销量事实的直接证明
- `allowWrite` 目前保留为显式安全开关，但当前 MarketBot 接入未开放点赞、评论、收藏、发帖等写操作
- 当前写操作仅开放 `post`，而且只支持图片笔记；仍未开放点赞、评论、收藏、关注等交互动作
- 该 CLI 本质上依赖本机浏览器 cookie 或二维码登录；如果 `xhs status` 不可用，先修复 CLI 登录态，不要先排查 MarketBot
- 小红书数据更适合用来观察消费者讨论和品牌声量，不应替代成交、财报、渠道销售或官方披露数据

## Twitter CLI 集成

如果你想让 agent 原生读取 Twitter/X 搜索结果、线程、用户资料、用户发文，甚至在受控模式下发帖，可以接入本地 `twitter-cli`。

### 1. 先安装并登录 `twitter-cli`

先在你自己的 Python 环境里安装 `twitter-cli`，并确认 `twitter` 命令可执行。然后确保本机浏览器里已经处于有效登录态，或者提前设置好：

```bash
export TWITTER_AUTH_TOKEN=...
export TWITTER_CT0=...
```

如果你依赖浏览器 cookie，推荐先验证 CLI 自身可用：

```bash
twitter status --json
twitter search "NVDA guidance" --type Latest --max 10 --json
```

### 2. 配置 MarketBot

在 `~/.marketbot/config.json` 中加入：

```json
{
  "tools": {
    "twitterCli": {
      "enabled": true,
      "command": "twitter",
      "timeoutS": 45,
      "browser": "chrome",
      "chromeProfile": "Profile 2",
      "homeDir": "~/.marketbot",
      "allowWrite": false
    }
  }
}
```

建议：

- `command` 最好写成绝对路径，例如 `"/Users/you/project/.venv/bin/twitter"`，避免 PATH 差异导致运行时找不到命令
- `browser` 只在你有多个浏览器时需要显式指定；常见值是 `arc`、`chrome`、`edge`、`firefox`、`brave`
- `chromeProfile` 只在你想锁定某个 Chromium profile 时配置，例如 `"Profile 2"`
- `homeDir` 建议单独指定一个可写目录，用来隔离 `twitter-cli` 的本地状态
- `allowWrite` 保持 `false`

### 3. 验证链路

先验证 CLI 自身：

```bash
twitter status --json
twitter user elonmusk --json
twitter search "TSLA deliveries" --type Latest --max 10 --json
```

如果上面正常，再验证 MarketBot：

```bash
marketbot status
marketbot agent -m "帮我总结一下 Twitter 上关于 NVDA 最新 guidance 的讨论重点和整体情绪，只给我简明结论。"
```

### 4. 运行时行为

- 默认按只读模式设计，当前接入开放 `status / whoami / search / tweet / article / user / user_posts / likes / followers / following / feed / bookmarks / list`
- 当 `tools.twitterCli.allowWrite=true` 时，额外支持受控 `post / reply / quote / like / unlike / retweet / unretweet / bookmark / unbookmark / follow / unfollow / delete`
- 现有 `twitter-browser-research` skill 会优先使用 `twitter_cli`，缺失时再回退到 `browser_site`
- 在默认 Twitter/X 分析请求下，运行时会优先走 `twitter_cli`，不会再优先走 `exec`、本地缓存文件或 browser 旁路
- `homeDir` 可选；配置后会把 CLI 的 `HOME` 指向该目录，适合隔离 cookie 与运行时缓存

### 5. 边界与风险

- 适合做市场叙事、线程解读、交易员/分析师评论和事件发酵观察，不适合作为事实来源的唯一依据
- `allowWrite` 是显式安全开关；默认关闭，建议只有在你明确需要 agent 发帖或互动时再打开
- 该 CLI 本质上依赖本机浏览器 cookie 或环境变量认证；如果 `twitter status` 不可用，先修复 CLI 登录态，不要先排查 MarketBot
- Twitter/X 数据更适合做快信号和传播路径观察，不应替代公告、财报、交易所披露或正式新闻源

## Skill 搜索与安装

可以先搜本地 skill，不够再回退到外部 curated skill 目录：

```bash
marketbot skills search "kubernetes deployment"
marketbot skills install k8s-release
```

安装后的外部 skill 会写入 `workspace/skills/`，下一次新会话会自动作为 workspace skill 加载。

## 开发

| 路径 | 说明 |
| --- | --- |
| `marketbot/agent/` | runtime loop、context、session 处理 |
| `marketbot/runtime/` | tool bootstrap 和运行时 wiring |
| `marketbot/domain/market/` | 市场领域服务和运行时能力画像 |
| `marketbot/skills/` | 内置 skill 和 skill metadata |
| `marketbot/channels/` | 各渠道适配器 |
| `marketbot/cache/` | market cache |
| `marketbot/market_reporting.py` | 报告渲染与 explainability 输出 |
| `tests/` | 回归测试 |

常用命令：

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -p pytest_asyncio.plugin
```

新增一个金融能力的常见路径：

1. 在 `marketbot/skills/<name>/SKILL.md` 新增或调整 skill
2. 给 skill 增加触发条件、输出、风险、freshness、市场、资产类别、required tools 等 metadata
3. 如果需要新的标准化数据访问，就扩展 `marketbot/domain/market/`
4. 如果需要新的原子能力，再暴露对应 tool
5. 补 skill routing、tool contract、report renderer 相关测试

## License

MIT
