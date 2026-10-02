# Nanobot 参考与金融默认能力

本次以 [HKUDS/nanobot](https://github.com/HKUDS/nanobot) 的最新 `main` 为参考，
采用它的通用执行器、渐进加载 skills 和可配置 MCP 的边界。MarketBot 继续使用自己的
金融领域服务和 CLI/gateway。Nanobot 源码不是 MarketBot 的运行依赖。

参考快照位于 `../reference/nanobot`；旧目录备份为 `../reference/nanobot-backup-20261002`。
分支、完整 commit 和更新时间记录于 [reference/nanobot.json](../reference/nanobot.json)。

## 初始化与升级

```bash
uv sync --extra dev
uv run marketbot onboard
# 已有配置：保留模型、API Key、市场数据源、MCP 自定义参数与工作区模板
uv run marketbot onboard --refresh
# 独立配置与工作区
uv run marketbot onboard --config ./finance-config.json --workspace ./finance-workspace
uv run marketbot status --config ./finance-config.json --json
uv run marketbot agent --config ./finance-config.json -m "分析 NVDA 的基本面、催化剂与风险"
```

初始化默认启用金融领域工具，内置研究、财报、催化剂、风险、持仓、期权、宏观、
选股等 skills，并写入金融研究助手模板。中文与英文请求均能触发核心金融 skills。
自定义工作区中的同名 skill 和现有模板保留优先级；刷新只创建缺失模板。

## 默认 MCP

`tools.mcpServers.finance` 默认启用，直接启动安装 MarketBot 的 Python 环境，
无需 npm、额外 MCP 包或金融数据账号。服务复用金融领域工具和参数校验：

| 原始工具名 | 用途 |
| --- | --- |
| `market_source_plan` | A 股、港股、美股的数据源路由 |
| `market_snapshot` | 行情快照 |
| `market_fundamentals` | 基本面与估值数据 |
| `market_news` | 市场资讯 |
| `market_macro` | 宏观数据 |
| `market_event_extract` | 催化剂与事件提取 |
| `market_social_sentiment` | 社区情绪 |
| `market_chip_distribution` | A 股筹码分布 |
| `portfolio_risk` | 确定性持仓估值、跨币种权重、集中度与假设压力情景 |
| `evidence_get` / `evidence_list` | 读取并校验已有研究证据与结论引用 |
| `logic_chain_visualizer` | 将提供的逻辑链渲染为 Markdown / Mermaid |

客户端中的名称为 `mcp_finance_<原始工具名>`。MarketBot 的内置金融工具使用同一数据服务，
Agent 优先调用原生工具；MCP 接口也可独立提供给 Nanobot 等兼容客户端：

```json
{
  "tools": {
    "mcpServers": {
      "finance": {
        "command": "/absolute/path/to/MarketBot/.venv/bin/python",
        "args": ["-m", "marketbot.mcp.finance", "--config", "/absolute/path/to/finance-config.json"],
        "toolTimeout": 60,
        "enabledTools": ["market_source_plan", "market_snapshot", "market_fundamentals"]
      }
    }
  }
}
```

MarketBot 自己的默认配置保存 `command: "python"`，运行时自动使用当前解释器，
并把有效市场配置和工作区传入子进程。关闭 `tools.market.enabled` 会同时关闭默认金融 MCP。
已有 `finance` 自定义 MCP 配置和 `enabled: false` 不会在刷新时被覆盖。

`enabledTools` 接受原始名称或完整客户端名称，`["*"]` 表示全部，`[]` 表示不注册工具。
`startupTimeout` 控制连接、初始化与发现工具的总预算；`toolTimeout` 控制单次调用。
失败连接会单独清理，其他服务继续可用。

## 可选 Alpha Vantage

默认同时写入关闭状态的 `alphavantage` 预设，使用
[官方本地 MCP 包](https://github.com/alphavantage/alpha_vantage_mcp) 的
`uvx marketdata-mcp-server YOUR_API_KEY` 接口。启用前安装 `uv`，设置环境变量：

```bash
export ALPHA_VANTAGE_API_KEY="your-key"
```

然后在配置中把 `tools.mcpServers.alphavantage.enabled` 改为 `true`。
`${ALPHA_VANTAGE_API_KEY}` 在连接时解析，配置文件保留占位符。
`command`、`args`、`env`、`url` 和 `headers` 均支持 `${VAR}`；启用服务缺少变量时跳过连接。
状态命令只显示变量名称、启用状态和本地命令是否存在，不展示凭证，不主动联网。

默认行情查询按标的所属市场分别获取数据，再合并 A 股、港股、美股和其他资产的结果。
部分来源失败时保留成功报价，并明确列出缺失标的，避免把部分返回当成完整覆盖。

## 持仓风险计算

组合分析 skill 先获取真实持仓、价格与明确汇率，再调用只读 `portfolio_risk`。
持仓数量、价格、现金、汇率和情景冲击支持十进制字符串；金额结果也返回十进制
字符串以保留精度。汇率定义为一单位外币折合多少报告币种。缺少必需汇率或非法
价格时返回错误，不静默忽略持仓。保留输入的出处和观察时间，并提示缺失出处。

计算范围是市值、权重、现金与币种暴露、持仓集中度和明确假设的统一价格冲击。
模型负责解释计算结果。相关性、Sharpe、beta、收益率与优化权重需要另行取得真实
历史序列并计算，不能用行情快照填入推测数字。示例与输入契约见
[portfolio-analyzer](../marketbot/skills/portfolio-analyzer/SKILL.md)。

计划执行也已加强：前序采集证据进入后续步骤，空白名单代表禁止调用工具，实际
执行检查与 prompt 中的工具范围一致。产品方向与类似项目参考见
[金融 Agent 定位说明](marketbot_financial_agent_direction.md)。

## 验证边界

离线测试验证配置升级、技能路由、MCP 白名单/分页/超时/隔离，以及实际 stdio 协议的
初始化、工具发现和数据源规划调用。安装包也验证技能支持文件完整性。
`configured` 只表示本地配置满足启动条件，不表示金融接口已连接或实时行情可用。
行情、资讯和宏观数据仍受网络、来源授权与限流影响；生成研究报告还需配置 LLM 凭证。

2026-10-03 验收：833 项 pytest 全部通过，改动文件 Ruff 检查通过，sdist 和 wheel
均包含全部 113 个技能资源。通过实际默认金融 MCP 同时查询 `SPY`、`600519` 和
`0700.HK`，三份报价均返回，缺失标的列表为空。LLM 在线对话与 Alpha Vantage 接口
尚未进行在线联调。

新增持仓工具也通过实际 stdio MCP 调用：用明确的示例输入计算出 `60000 CNY`
组合总值；假设持仓价格统一下降 20%、现金与汇率不变，结果为 `50000 CNY`，
并标为假设情景。这项验证检查协议和计算，不验证输入为实时市场数据。
