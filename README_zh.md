<div align="center">
  <img src="marketbot_logo.png" alt="marketbot" width="420">
  <h1>marketbot</h1>
  <p><strong>一个以 skill 为核心、面向金融分析的轻量级 AI 助手。</strong></p>
  <p><strong><a href="README.md">English</a> | 中文</strong></p>
</div>

`marketbot` 从极简通用助手 `nanobot` 演化而来，但现在的重心已经明确转向金融分析：

- 上层用 skill 编排分析行为，而不是把能力塞进一大段 prompt
- 中层用统一的 quote/news/macro 领域服务，而不是每个 tool 各自抓数据
- 输出层自带 skill routing、data reliability、source health、route trace 等解释信息
- 支持 Telegram、Slack、Discord、飞书、钉钉、Email、WhatsApp、QQ、Mochat，以及可选的 Matrix

## 它适合做什么

marketbot 适合“既想保留 agent 灵活性，又希望金融分析有明确结构”的场景：

- 针对一组标的生成市场简报
- 做 watchlist 监控与周期性报告
- 按市场、资产类别、freshness、tool 可用性自动选择 skill
- 把报告推送到聊天工具
- 在需要时快速读懂和修改代码

## 为什么是 marketbot

- **skill-first**：skill 仍然是最高层编排单元。skill metadata 可以声明触发条件、输出形态、风险级别、时效要求、市场覆盖、资产类别和依赖工具。
- **外部 skill 兜底**：当本地没有合适 skill 时，marketbot 可以从 `awesome-openclaw-skills` 索引和 `openclaw/skills` 仓库里给出外部候选，而不是直接停在“没有 skill”。
- **runtime 很薄**：runtime 主要负责消息处理、会话、并发、取消、tool 执行和渠道发送，不再承载大量金融逻辑。
- **市场领域层更稳**：quote、news、macro 走共享的 market domain services，支持缓存、fallback、路由遥测和运行时能力画像。
- **输出可解释**：聊天、报告、通知都可以携带能力说明和数据可靠性说明。
- **适合长期演化**：同一套能力可以服务 CLI、定时任务和多渠道推送。

## 架构分层

项目现在可以按四层理解：

1. **Runtime**
   - `marketbot/agent/loop.py`
   - `marketbot/agent/processor.py`
   - `marketbot/runtime/bootstrap.py`
   - 负责消息入口、按 session 并发、tool 注册、会话保存和最终响应。

2. **Skills**
   - `marketbot/skills/*/SKILL.md`
   - 负责更高层的分析策略和任务编排。
   - skill metadata 会参与路由和过滤。

3. **Market domain**
   - `marketbot/domain/market/services.py`
   - `marketbot/domain/market/profile.py`
   - 负责标准化的行情、新闻、宏观访问，以及 cache、source health、route trace 和 runtime capability profile。

4. **Reporting / Delivery**
   - `marketbot/market_reporting.py`
   - `marketbot/channels/*`
   - 负责把结构化分析结果渲染为聊天回复、保存报告和通知消息。

## 安装

从源码安装：

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

## 快速开始

### 1. 初始化

```bash
marketbot onboard
```

这会创建默认工作区和 `~/.marketbot/config.json`。

### 2. 配置模型与市场工具

最小示例：

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
      "quoteSource": "yahoo",
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

### 3. 直接聊天使用

```bash
marketbot agent
```

### 4. 生成市场简报

```bash
marketbot market report --symbols NVDA,SPY --save
```

常用选项：

- `--json`：输出原始结构化结果
- `--session auto|premarket|intraday|close`
- `--notify --notify-channel telegram --chat-id 10001`

### 5. 生成周期性报告模板

```bash
marketbot market heartbeat-setup
```

## 核心金融能力

当前内置 skill 主要围绕以下几类高价值场景：

| Skill | 作用 |
| --- | --- |
| `market-report` | 对标的或 watchlist 生成市场简报 |
| `daily-stock-screener` | 对每日股票列表做估值、趋势、量能和情绪筛选排序 |
| `market-monitor` | 做持续监控和观察 |
| `market-discovery` | 做机会扫描和主题发现 |
| `news-intelligence` | 做新闻事件提取与冲击分析 |
| `sentiment-analysis` | 做新闻和社交情绪整合 |
| `portfolio-analyzer` | 做组合层面的风险与结构分析 |
| `stock-data-sourcing` | 给出市场相关的数据源与路由建议 |
| `risk-checklist` | 输出风险清单 |
| `catalyst-tracker` | 做催化剂跟踪 |

底层 market tool 主要包括：

- `market_snapshot`
- `market_news`
- `market_macro`
- `market_signal`
- `market_brief`
- `market_source_plan`
- `market_event_extract`
- `market_social_sentiment`
- `market_fundamentals`
- `market_chip_distribution`

## 可解释性与可靠性

marketbot 的一个重点是让金融输出更容易检查和追溯。

系统可以暴露：

- **skill routing**：这轮用了哪些 skill
- **blocked reasons**：为什么某个 skill 没被选中
- **data reliability**：snapshot/news/macro 的总体可靠性
- **source health**：每个 provider 当前是 `ok`、`cached`、`fallback` 还是 `error`
- **route trace**：数据访问链路是如何路由和降级的

这些信息会进入：

- chat 回复
- 保存的 market report
- 通知摘要
- outbound metadata

可解释性行为支持按渠道配置：

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
| 飞书 | 支持文本、post、card 风格 |
| 钉钉 | Stream mode |
| Email | IMAP + SMTP |
| WhatsApp | 通过桥接服务集成 |
| QQ | Bot 集成 |
| Mochat | Socket.IO + HTTP |
| Matrix | 可选依赖 |

多渠道长期运行：

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

## Skill 搜索与安装

可以直接用 CLI 先搜本地 skill，不够再回退到外部 curated skill 目录：

```bash
marketbot skills search "kubernetes deployment"
marketbot skills install k8s-release
```

安装后的外部 skill 会写入 `workspace/skills/`，下一次新会话会自动作为 workspace skill 加载。

## 开发

### 运行测试

项目建议这样跑测试，`PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` 是刻意保留的：

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 pytest -p pytest_asyncio.plugin
```

### 关键目录

| 路径 | 说明 |
| --- | --- |
| `marketbot/agent/` | runtime loop、context、session 处理 |
| `marketbot/runtime/` | tool bootstrap 和运行时 wiring |
| `marketbot/domain/market/` | 市场领域服务、插件、运行时能力画像 |
| `marketbot/skills/` | 内置 skill 和 skill metadata |
| `marketbot/channels/` | 各渠道适配器 |
| `marketbot/cache/` | market cache |
| `marketbot/market_reporting.py` | 报告渲染与 explainability 输出 |
| `tests/` | 回归测试 |

### 新增一个金融能力的常见路径

1. 在 `marketbot/skills/<name>/SKILL.md` 新增或调整 skill
2. 为 skill 增加触发条件、输出、风险、freshness、市场、资产类别、required tools 等 metadata
3. 如果需要新的标准化数据访问，就扩展 `marketbot/domain/market/`
4. 如果需要新的原子能力，再暴露对应 tool
5. 补 skill routing、tool contract、report renderer 相关测试

## License

MIT
