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
- 结果可以发到 CLI、周期性任务和多种聊天渠道

## 你可以用它做什么

- 针对一组标的生成市场简报
- 给持仓生成热点事件和催化监控清单
- 做 watchlist 的日常监控、筛选和周期性报告
- 按市场、资产类别、freshness、工具可用性自动选择 skill
- 把结果推送到聊天渠道，并保留可靠性说明
- 在需要时快速修改数据路由、skill 和输出逻辑

## 为什么不是普通聊天机器人

- `skill-first`
  金融分析不是一段大 prompt。每个 skill 都可以声明触发条件、输出形态、风险级别、时效要求、市场覆盖、资产类别和依赖工具。
- `领域层独立`
  quote、news、macro 走共享的 market domain services，而不是散落在每个 tool 里的抓取逻辑。
- `输出可解释`
  聊天回复、报告和通知都可以带上 skill routing、blocked reasons、source health 和 data reliability。
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

常见内置 skill：

| Skill | 作用 |
| --- | --- |
| `market-report` | 对标的或 watchlist 生成市场简报 |
| `market-monitor` | 做持续监控和观察 |
| `market-discovery` | 做机会扫描和主题发现 |
| `news-intelligence` | 做新闻事件提取与冲击分析 |
| `sentiment-analysis` | 做新闻和社交情绪整合 |
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
      "quoteSource": "auto",
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

- `quoteSource: auto` 适合混合市场
- `newsSources` 决定新闻路由顺序
- `macroSource: fred` 需要 FRED API key；没有 key 时会明确降级
- `explainabilityMode` 控制是否在结果里带能力和可靠性说明

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
