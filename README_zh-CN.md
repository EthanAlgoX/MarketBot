[English](README.md) | [简体中文](README_zh-CN.md)

# MarketBot

[金融工作流](docs/finance_workflows_zh-CN.md) · [金融默认配置](docs/finance_defaults_zh-CN.md) · [集成与部署](docs/integrations_zh-CN.md)

MarketBot 是面向个人投资者的金融研究 Agent，服务于跨市场研究、持仓风险分析与持续跟踪。轻量 Agent 运行时集成金融工具、技能和 MCP，配合持久化研究记录与可配置通信渠道，把研究证据、可验证假设与变化提醒连接成完整流程。

金融特色来自可复查的流程：结论保留数据来源和时间；持仓按币种计算；投资假设按显式规则复核；持续跟踪只在满足条件或出现数据缺口时产生提醒。Skills 负责研究方法，工具负责取数和计算，模型负责组织分析。

本页对应当前 `main` 分支；已发布的 PyPI 包可能尚未包含本页的全部功能。Python 要求 **3.11+**。模拟数据和规则信号用于研究与测试，项目不执行真实交易。

## 安装并完成第一次计算

以下命令从源码安装，使用项目内独立配置和工作目录。后续命令均在仓库根目录执行，沿用这两个变量。

```bash
git clone --branch main --single-branch https://github.com/EthanAlgoX/MarketBot.git
cd MarketBot
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e .

export MARKETBOT_CONFIG_PATH="$PWD/.local/readme/config.json"
export MARKETBOT_WORKSPACE="$PWD/.local/readme/workspace"
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" onboard
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" status --json
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance call portfolio_risk --input examples/finance/portfolio.json
```

最后一个命令无需模型、行情账号或联网。示例价格和汇率是人工假设：资产总值应为 **60000 CNY**，股票统一下跌 20% 后为 **50000 CNY**，现金不受股票冲击影响。数值使用 Decimal 计算；缺少币种或必要汇率时返回错误，不给出不完整估值。

配置与 workspace 是两个独立路径。所有命令支持放在子命令前的 `--config` 和 `--workspace`；已有的子命令局部参数仍可使用。省略参数时使用 `~/.marketbot/config.json` 和配置中的 workspace。自定义配置不存在时，先 `onboard`；现有文件损坏时命令会报错并保留文件。

已有安装可执行以下命令补充金融默认配置，保留现有模型、渠道和用户设置：

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" onboard --refresh
```

## 切换英文或简体中文

默认语言为英文，配置项 `agents.defaults.language` 默认为 `"en"`；简体中文使用 `"zh"`。命令名称和 JSON 字段保持英文，供应商原始数据及用户研究笔记保留原文。

```json
{"agents": {"defaults": {"language": "en"}}}
```

顶层参数可覆盖本次调用；普通命令不改已保存的偏好。`onboard` 是明确的例外：创建或刷新配置时会保存所选语言。

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" --language zh status
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" --language zh agent -m "研究600519、0700.HK和SPY，列出实际观测时间、证据与风险。"
```

保存中文偏好、查看当前设置、再切回英文：

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" language --set zh
marketbot --config "$MARKETBOT_CONFIG_PATH" language --json
marketbot --config "$MARKETBOT_CONFIG_PATH" language --set en
```

Agent 回复、市场报告与情报日报的标题、章节和说明遵循所选语言；用户明确要求其他输出语言时优先遵从。初始化、语言设置与状态关键界面支持中英文。完整 `--help` 技术参考、命令名称、JSON 字段、第三方错误与金融工具警告保留原文。

Agent 调用仍需配置模型。现有工作区自定义指令不会被替换；若其中明确指定了其他回复语言，请检查并按需求修改。页面顶部的语言链接可切换完整文档。

## 金融研究流程

### 1. 计算持仓并保留证据

`finance call` 直接运行金融工具，输入是 JSON 对象，输出是 JSON；失败会返回非零退出码。上面的持仓计算会返回 `evidenceRecordId`。把该 ID 写入查询文件，即可读取完整计算输入、结果和摘要校验信息：

```bash
# 把 ev_... 替换为刚才返回的完整 evidenceRecordId
python -c 'import json; json.dump({"evidenceId": "ev_..."}, open(".local/readme/evidence.json", "w"))'
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance call evidence_get --input .local/readme/evidence.json
```

`evidence_list` 可以按标的、类型和来源查询。原始观察时间 `observedAt`、发布时间 `publishedAt` 与采集时间分开存储；采集时间不能代替行情时间。证据引用用于追溯来源，不能证明来源本身一定正确。

### 2. 建立可复核的投资假设

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance call thesis_tracker --input examples/finance/thesis.json
```

记录返回的 `thesis.id`。该示例只建立“价格低于 1000 CNY 时证伪”的假设，并保留 `confidence: 0`。后续 `update` 保存研究备注；`review` 使用证据 ID、JSON Pointer 和显式规则核对事实。负面文字、模型判断和缺失或过期数据不会自动证伪。完整的查询、复核和 FX 示例见 [金融工作流](docs/finance_workflows_zh-CN.md)。

### 3. 持续跟踪变化

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance call market_watch --input examples/finance/watch.json
# 将 WATCH_ID 替换为返回的 watch.watchId
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance poll WATCH_ID
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance schedule WATCH_ID --every-minutes 15
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance schedule-list
# 后台持续运行；按 Ctrl+C 停止
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" gateway --finance-only
```

`poll` 需要可用的公开行情接口。首次有效观察建立基线；默认价格变化以该固定基线比较，同一阈值事件只提醒一次。过期、未知时间、缺失行情或缺失 FX 产生 `data_gap`，不会推进基线；此时 `poll` 非零退出属于明确的数据质量失败。休市期间应合理调整 `maxAgeSeconds`，不要把旧收盘价当作当前价。

调度只保存任务，运行中的 Gateway 才会执行。`--finance-only` 无需模型，只执行原生金融和情报定时任务；普通 Gateway 同时支持聊天、模型任务与 Heartbeat，需要模型配置。删除任务用 `finance unschedule JOB_ID`。本地提醒保存在 watch outbox，查询和确认使用 `market_watch` 的 `outbox` / `ack`；渠道投递需配置账号和明确的 `--deliver --channel CHANNEL --to TARGET`。投递按至少一次处理，失败后可能重试。

### 4. 获取行情、新闻和报告

```bash
mkdir -p .local/readme
python -c 'import json; json.dump({"symbols": ["600519", "0700.HK", "SPY"]}, open(".local/readme/snapshot.json", "w"))'
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" finance call market_snapshot --input .local/readme/snapshot.json
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" market report --symbols 600519,0700.HK,SPY --save
```

公开源可能限流、延迟或不可达。查看 `warnings`、`sourceHealth`、每条行情的 provider、currency、priceType 和时间；缺少新闻不代表没有事件。`mock` 明确标记为模拟。FRED 宏观数据和部分搜索、TickFlow、Alpha Vantage 能力需要独立 API key；未配置时应读取缺失提示，不把回退分数当作真实宏观事实。

## 配置模型后使用 Agent

先完成上面的本地计算。模型账号仅在使用 `agent`、完整 Gateway、模型任务或模型 Heartbeat 时需要。

下面为 OpenAI 兼容接口的配置方式。把变量设置为你自己的服务地址、模型 ID 和 key；脚本合并到已有配置，不会移除金融预设。配置文件应留在本机。

```bash
export MARKETBOT_MODEL='YOUR_MODEL_ID'
export MARKETBOT_API_BASE='https://YOUR_ENDPOINT/v1'
read -s MARKETBOT_API_KEY
export MARKETBOT_API_KEY
python - <<'PY'
import json, os
from pathlib import Path
path = Path(os.environ["MARKETBOT_CONFIG_PATH"])
data = json.loads(path.read_text())
data["providers"]["custom"].update(apiKey=os.environ["MARKETBOT_API_KEY"], apiBase=os.environ["MARKETBOT_API_BASE"])
data["agents"]["defaults"].update(provider="custom", model=os.environ["MARKETBOT_MODEL"])
path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
path.chmod(0o600)
PY
unset MARKETBOT_API_KEY
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" agent -m "研究 600519、0700.HK 和 SPY：列出数据时间、证据、风险与待验证事项。"
```

交互模式为 `marketbot ... agent`，`--session` 指定会话，`--no-markdown` 输出纯文本。运行时支持工具调用、子任务、会话保存、记忆整理、技能选择与 MCP。结果质量还取决于模型和数据；确定性协议测试不能代替真实模型评测。其他提供商与 OAuth 登录见 [集成指南](docs/integrations_zh-CN.md)。

## 功能入口与边界

| 功能 | 入口 | 使用条件与边界 |
| --- | --- | --- |
| 配置、初始化、诊断 | `onboard`, `status`, `channels status` | 状态显示配置和依赖可用性；OAuth `not_checked` 不表示已登录 |
| 18 个原生金融工具 | `finance call`, Agent 工具调用 | 行情、基本面、新闻、情绪、宏观、规则信号、筹码估算、来源规划、事件提取、逻辑图、简报、情报查询、持仓、证据与假设、监控 |
| 金融 MCP | `python -m marketbot.mcp.finance` | stdio 协议，12 个只读工具，复用原生实现；需要写操作的流程使用原生工具 |
| 63 个内置技能及动态评分 | `skills search`, `skills install`, `skills score show/reset` | 研究方法、市场、ETF、组合、风险等；技能使用成功率不等于投资收益率 |
| 情报采集与摘要 | `intel source-add/source-list/collect/digest-daily/digest-list/digest-show` | RSS / 网站来源，去重和本地数据库；页面正文抓取不等于完整网页解析 |
| 原生定时任务 | `intel schedule-*`, `finance schedule*`, `gateway --finance-only` | 支持 cron / 间隔调度，进程需持续运行 |
| Agent 与 Heartbeat | `agent`, `gateway`, `market heartbeat-setup` | 配置模型；Heartbeat 是模型驱动任务，finance-only 不运行它 |
| 10 种聊天渠道 | `channels status/login`, `gateway` | Telegram、Discord、WhatsApp、Feishu、Mochat、DingTalk、Slack、Email、QQ、Matrix；真实账号验收另需平台凭据 |
| 浏览器、飞书、小红书、Twitter | 配置 `tools.browser/larkCli/xiaohongshuCli/twitterCli` | 可选 CLI 桥接，需要安装工具和登录；外部写操作由权限策略约束 |
| 本地 RL 与训练数据导出 | `rl evaluate/collect/build-dataset/train/export-openclaw` | 历史价格模拟、奖励计算和脚本导出；当前适配器不完成模型参数训练 |
| RL HTTP 与指标服务 | `rl serve-env/serve-metrics`, `rl *openclaw*` | 独立本地 HTTP 服务和训练产物观察；Slime/GPU 执行需要外部训练环境 |
| 容器部署 | Dockerfile / Compose | Gateway 是进程，不提供 HTTP API；WhatsApp bridge 需单独运行 |

`marketbot --help`、`marketbot finance --help`、`marketbot intel --help`、`marketbot rl --help` 给出完整参数。技能提示不新增数据接口；基本面摘要、筹码估算和规则信号也不等同于完整财报、真实持仓分布或收益保证。

## 情报与 RL 示例

```bash
# 公共 RSS 是否可达取决于所在网络，记录实际返回的 Source ID
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" intel source-add --name "Federal Reserve" --type rss --url https://www.federalreserve.gov/feeds/press_all.xml
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" intel source-list
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" intel collect
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" intel digest-daily --hours 24 --limit 20
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" intel digest-list
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" intel schedule-daily --every-minutes 60
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" intel schedule-list
# 移除使用 intel schedule-remove JOB_ID；运行使用 gateway --finance-only

# 示例价格仅用于模拟，并非历史回测结论
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" rl evaluate --symbol SPY --prices 100,101,99,103 --action buy --json
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" rl collect --symbol SPY --prices 100,101,99,103 --output .local/readme/episodes.jsonl --json
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" rl build-dataset --input .local/readme/episodes.jsonl --output .local/readme/dataset.jsonl
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" rl train --dataset .local/readme/dataset.jsonl --output-dir .local/readme/trainer --dry-run --json
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" rl export-openclaw --dataset .local/readme/dataset.jsonl --output-dir .local/readme/openclaw --dry-run --json
```

`rl train --no-dry-run` 目前也只导出适配器产物；生成的 Slime shim 使用规则信号，不是已训练模型的推理。OpenClaw 启动、指标和完整部署方法见 [集成指南](docs/integrations_zh-CN.md) 与 [RL 设计说明](docs/marketbot_rl_integration_plan.md)。

## 复现评测

```bash
python -m pip install -e '.[dev]'
python -m pytest tests
python scripts/evaluate_finance.py --output .local/finance-evaluation.json
python scripts/evaluate_readme.py --output .local/readme-evaluation.json
# 可选：公开行情、新闻、宏观接口验收，依赖网络和源可用性
python scripts/evaluate_readme.py --network --output .local/readme-network-evaluation.json
```

README 评测使用临时 workspace，按文档执行真实 CLI；RSS 和模型协议通过本地 HTTP fixture 验证，MCP 通过独立 stdio 进程验证。fixture 的结果标记为模拟，不代表真实模型质量、渠道送达、盈利能力或线上数据准确性。安装包也需在仓库外的干净虚拟环境复测。

本轮双语版本的验证见 [英文优先与中文切换评测](docs/english_first_language_evaluation_2026-10-03_zh-CN.md)；更完整的功能覆盖、问题修复与未配置项见 [功能评测报告](docs/readme_feature_evaluation_2026-10-03.md)。金融验收重点包含 Decimal 精度、跨币种估值、缺失 FX、证据完整性、过期数据、伪造观察、假设复核和提醒幂等性。

## 架构与参考

`marketbot/agent` 负责 Agent 循环、会话、记忆、工具与技能；`runtime` 负责组装；`domain/market` 负责金融逻辑和证据存储；`domain/intel` 负责情报；`channels` 负责渠道；`mcp` 负责协议；`rl` 负责模拟和训练桥接。金融原生工具、CLI 与 MCP 共享领域实现。

可借鉴的开源项目包括 [OpenBB](https://github.com/OpenBB-finance/OpenBB)、[TradingAgents](https://github.com/TauricResearch/TradingAgents)、[AI Hedge Fund](https://github.com/virattt/ai-hedge-fund)、[FinRobot](https://github.com/AI4Finance-Foundation/FinRobot)、[Qlib](https://github.com/microsoft/qlib) 和 [RD-Agent](https://github.com/microsoft/RD-Agent)。已整理其参考方向、许可证与取舍，见 [金融 Agent 产品方向](docs/marketbot_financial_agent_direction.md)。后续优先扩展用户持仓与研究档案、公司公告、事件日历、来源交叉核对和成本可观察性。

MIT License。项目使用及分发第三方技能与参考代码时，应保留对应来源和许可证说明。
