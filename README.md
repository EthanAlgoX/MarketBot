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

## 5 分钟上手

### 1. 安装

```bash
git clone https://github.com/EthanAlgoX/MarketBot.git
cd MarketBot
pip install -e .
```

如果需要 Matrix：

```bash
pip install -e ".[matrix]"
```

如果是开发环境：

```bash
pip install -e ".[dev]"
```

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

## 常见使用场景

```bash
marketbot agent -m "根据我的持仓生成今天盘前监控清单：SPY,NVDA,GOOG,TSLA,UNH,07709,513310"
marketbot agent -m "列出 NVDA、UNH、07709 未来两周最重要的催化和风险"
marketbot agent -m "筛选今天值得重点看的股票：NVDA,TSLA,INTC,TTD,CRWV"
marketbot agent -m "为什么 07709 走这个价格源？给我看数据路由和可靠性"
```

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

目前支持：

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

长期运行：

```bash
marketbot gateway
```

查看当前状态：

```bash
marketbot status
marketbot channels --help
marketbot provider --help
marketbot skills --help
```

## Browser 集成

如果要启用 `bb-browser` 集成，建议先从保守配置开始：

```json
{
  "tools": {
    "browser": {
      "enabled": true,
      "command": "bb-browser",
      "mode": "safe",
      "allowSites": ["xueqiu", "eastmoney", "reddit", "github", "youtube"],
      "allowDomains": ["xueqiu.com", "eastmoney.com", "reddit.com", "github.com", "youtube.com"],
      "allowUrlPrefixes": ["https://www.youtube.com/watch?v=", "https://api.github.com/repos/"],
      "allowRequestCapture": false,
      "allowRequestBodies": false
    }
  }
}
```

说明：

- `safe` 只允许只读浏览动作
- `allowSites` / `allowAdapters` 约束 `browser_site`
- `allowDomains` / `allowUrlPrefixes` 约束页面打开和网络抓取
- `allowRequestCapture` 与 `allowRequestBodies` 默认建议关闭

## Skill 搜索与安装

可以先搜本地 skill，不够再回退到外部 curated skill 目录：

```bash
marketbot skills search "kubernetes deployment"
marketbot skills install k8s-release
```

安装后的外部 skill 会写入 `workspace/skills/`，下一次新会话会自动作为 workspace skill 加载。

## 开发

### 建议先看这些目录

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

### 跑测试

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -p pytest_asyncio.plugin
```

### 新增一个金融能力的常见路径

1. 在 `marketbot/skills/<name>/SKILL.md` 新增或调整 skill
2. 给 skill 增加触发条件、输出、风险、freshness、市场、资产类别、required tools 等 metadata
3. 如果需要新的标准化数据访问，就扩展 `marketbot/domain/market/`
4. 如果需要新的原子能力，再暴露对应 tool
5. 补 skill routing、tool contract、report renderer 相关测试

## License

MIT
