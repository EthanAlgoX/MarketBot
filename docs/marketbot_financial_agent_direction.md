# MarketBot 金融 Agent 定位与开源参考

调研与代码核对日期：2026-10-02 至 2026-10-03。第一阶段服务个人投资者，重点是跨市场研究、
持仓风险与持续跟踪。下文的项目比较来自官方源码和文档，未运行这些项目验证其
分析质量或投资表现。功能建议与当前已实现能力分别列出。

## 建议定位

**面向中文跨市场投资者，持续跟踪投资论点、核验研究依据，并解释新信息如何影响持仓的 Agent。**

典型任务可以是：“我同时持有美股科技股、港股和 A 股 ETF；今天的重要变化影响了
哪些持仓？哪些买入理由需要重新检查？在一个明确的假设情景下，组合会如何变化？”
回答应当包含影响路径、数据依据、组合暴露和下次检查条件。ETF 穿透持仓、行业
相关性和历史风险统计需要额外数据，当前不能由代码名称或单次报价推断。

Skills 提供流程，MCP 提供接入。产品的长期积累来自研究证据、持仓上下文、论点历史、
经过验证的计算和可复现评测，而不来自工具数量。

## 基于 Nanobot 的实现边界

本轮再次 fetch 主项目与 Nanobot：MarketBot 的远端 main 为 `4faa7fd`，Nanobot
参考版本为 `4fd6807`，完整 SHA 和本地路径见 [参考记录](../reference/nanobot.json)。
MarketBot 保留现有 Python 项目与金融领域代码，按 Nanobot 的执行层、扩展层与
产品层边界演进。当前没有把整个 Nanobot 最新源码替换成运行依赖，也不宣称已同步
它的全部 WebUI、Provider、上下文治理和插件能力。

| 层 | 采用的方式 | MarketBot 的责任 |
| --- | --- | --- |
| 通用执行层 | 参考 Nanobot 的 runner、工具注册与执行边界 | 会话、计划执行、工具范围、错误处理与渠道适配 |
| 扩展层 | 渐进加载 skills、可配置 MCP、清晰生命周期 | 默认金融技能包、本地金融 MCP 与可选外部数据接口 |
| 金融数据与计算层 | 独立领域模块，不在通用循环内计算金融指标 | 跨市场报价路由、统一数据口径、确定性计算、缺失数据处理 |
| 产品状态层 | 在通用记忆与调度基础上实现领域对象 | 持仓、投资论点、证据引用、失效条件、监控事件和复盘 |

Nanobot 官方[架构说明](https://github.com/HKUDS/nanobot/blob/main/docs/architecture.md)
将产品层与通用 runner、工具和 MCP 生命周期分开。更适合长期演化的做法是保留
这个边界，再逐项对齐需要的上游机制。初始化和接口使用见
[金融默认能力说明](nanobot_finance_defaults.md)。

## 当前能力与实际缺口

| 能力 | 已有实现 | 需要补齐的部分 |
| --- | --- | --- |
| 数据获取与观察 | `services.py` 的缓存、sourceHealth、routeTrace；多市场行情与缺失标的披露 | 工具响应时间与源数据观察时间区分、交易日/交易时段、财报口径与历史可见性 |
| 研究执行 | Router / Planner / Executor / Verifier、计划落盘、技能路由与回退 | 本轮修复空白名单实际放开工具、后续步骤未收到前序证据；仍需更强的内容验证 |
| 报告解释 | market_brief 含多个组件原始 JSON、可靠性信息；每日机会 Markdown 存档 | 本轮新增不可变证据账本、逐条来源/时间与 claim 绑定；后续完善历史研究回放和来源冲突检测 |
| 投资论点 | `theses.json` 记录观点、drivers、risks、状态和更新历史；本轮修复同标的不同中文论点的 ID 碰撞 | 本轮增加规则 + evidence/jsonPointer 复核；情绪不再自动证伪；定性前提仍需研究者判断 |
| 持仓风险 | 本轮新增 `portfolio_risk` 确定性计算与组合 skill 接入 | 本轮支持显式持仓保存与变化检查；后续扩展券商导入、ETF 穿透、行业暴露与历史序列风险 |
| 持续运行 | Cron、Heartbeat、情报采集、报告与渠道推送 | 本轮增加阈值状态转换/持仓变化/data gap 本地 outbox 与去重；后续交易日服务和远端投递回执 |
| 策略验证 | 启发式信号、rollout 记录、离线交易环境与风险惩罚 | 多资产可见信息回放、基准比较、独立投研评测、持续模拟账户；尚无获利能力验证 |

`sourceHealth=ok` 只表示取数过程成功，不证明数据足够新、口径正确或能支持某个结论。
技能路由历史“成功”也不等于投资收益。需要分别评价取数、计算、研究结论与最终表现。

## 本轮增加的可执行能力

`portfolio_risk` 是无网络、无存储修改的计算工具。用户或行情工具提供数量、价格、
币种与出处；所有金额用 Decimal 计算，结果以十进制字符串返回。跨币种必须提供
明确的换算率：一单位外币折合多少报告币种。缺少汇率、非法数量或价格时返回错误，
不把不完整的组合伪装成完整总值。

支持持仓市值、仓位权重、现金比例、币种暴露、持仓集中度和显式假设的统一价格
冲击情景。压力结果保持现金与 FX 不变，不是收益预测。当前不覆盖做空、衍生品、
杠杆、费用和历史序列统计。价格与汇率缺少出处或观察时间时会披露；工具不为
用户提供的数据真实性背书。接口见 [portfolio-analyzer skill](../marketbot/skills/portfolio-analyzer/SKILL.md)。

同时修复计划执行的两项可靠性问题：空集合表示禁止调用工具，实际执行也检查范围；
前序步骤的采集结果进入后续步骤上下文。组合计划优先暴露行情和计算工具，避免
工具目录被文件和浏览器能力占满后，金融工具无法进入计划。
主 Agent 和子 Agent 均遵循这些执行边界；关键金融工具的结构化结果不会被通用摘要
压缩丢失，从而保留价格、引用和已计算的组合指标。

## 开源项目参考

| 项目 | 具体借鉴点 | 适合放在哪一层 | 边界 |
| --- | --- | --- | --- |
| [FinRobot](https://github.com/AI4Finance-Foundation/FinRobot/tree/master/finrobot_desktop) | 当前 Desktop 实现的 typed pipeline、Python 估值 operators、币种/TTM/EV bridge/叙事数字审计 | 计算与验证 | 优先读当前 `finrobot_desktop`，不必迁入完整桌面应用或旧 AutoGen 运行栈 |
| [Dexter](https://github.com/virattt/dexter) | 研究任务规划、工具结果留痕、JSONL scratchpad、财务问答评测 | 研究执行与证据存档 | MarketBot 已有规划；重点借鉴可查性。模型评审不能替代数字验证；实现为 TypeScript/Bun |
| [OpenBB / ODP](https://github.com/openbq-org/OpenBB) | 输入/输出模型、provider 插件、标准字段、REST/MCP 出口 | 数据层 | 数据基础设施，完整研究体验需由 Agent 实现；授权、费用、覆盖按 provider 区分 |
| [TradingAgents](https://github.com/TauricResearch/TradingAgents) | 分析师视角、持仓上下文、按公开时间限制历史输入、按区域基准评测 | 研究验证与回放 | 优先借鉴历史可见性和评测，而非增加 Agent 数量；跨市场历史财报可见性并不相同 |
| [AI Hedge Fund](https://github.com/virattt/ai-hedge-fund) | 持久基金定义、风险限制、模拟交易、session ledger | 模拟账户与复盘 | 持续模拟账户是后续扩展；当前参考项目说明未执行真实交易 |
| [daily_stock_analysis](https://github.com/ZhuLinsen/daily_stock_analysis) | 中文自选股体验、交易日检查、定时分析、报告历史 | 个人投资者工作流 | 已有 Cron/推送可复用，重点改善只报告变化与持仓相关性 |
| [TradingAgents-CN](https://github.com/hsliuping/TradingAgents-CN) | 中文研究流程、A 股数据适配 | 中文金融语义与数据层 | 当前许可证分层，应用层不是统一的 Apache 开源许可，不整体复制 |

优先阅读顺序：**FinRobot + OpenBB 的计算/数据契约 → Dexter 的研究审计 →
TradingAgents 的历史验证**。例如 OpenBB 的
[标准化说明](https://docs.openbb.co/odp/python/developer/standardization)
要求明确百分比表示、缺失值和标准字段，值得用于约束我们的 provider 适配。

2026-10-02 查阅到的许可证：Nanobot MIT；FinRobot 和 TradingAgents Apache-2.0；
OpenBB 当前 develop 的 [LICENSE](https://github.com/openbq-org/OpenBB/blob/develop/LICENSE)
为 Apache-2.0，旧仓库地址已重定向；AI Hedge Fund 与 daily_stock_analysis MIT。
Dexter README 声明 MIT，本次检查未找到独立许可证文件，因此复制代码前需核对。
TradingAgents-CN 的 [LICENSE](https://github.com/hsliuping/TradingAgents-CN/blob/v3.0/LICENSE)
明确 `tradingagents/`、CLI 和文档等为 Apache-2.0，`app/`、`frontend/`、`core/` 为专有层。
本轮采用机制参考并自行实现，没有复制这些项目的代码。

## 建议开发顺序与验收

| 顺序 | 开发项 | 个人投资者获得的结果 | 验收标准 |
| --- | --- | --- | --- |
| 本轮 | 执行范围、计划证据贯通、确定性持仓计算 | 研究能使用采集结果，组合数字有明确输入与计算 | 无工具步骤不能调用任何工具；跨币种算术一致；缺失数据不静默形成总值 |
| 下一步 1 | 证据账本与论点检查条件 | 能回答“为什么改观点，哪条证据触发了变化” | 每条状态变化引用证据与条件；单纯负面情绪不能自动宣称论点已证伪 |
| 下一步 2 | 持仓与 watchlist 状态、事件变化监控 | 持仓相关变化、失效条件或数据风险发生时才提醒 | 同一事件去重；记录基线、上次检查与通知原因；按市场交易日运行 |
| 下一步 3 | 时间/币种/财报口径契约与持仓穿透 | 解释 A/H/US 联动及间接持仓暴露 | 分清观察/公开/检索时间；显式报告延迟/缺失；ETF 穿透必须有真实成分数据 |
| 下一步 4 | 金融研究评测与历史回放 | 改进效果可被重复验证 | 算术、引用、缺失处理、时间穿越、口径冲突分别评分；记录成本、耗时和基准 |
| 后续 | 持续模拟账户和复盘 | 研究建议在明确假设下形成可追踪结果 | 记录下决策时可见数据、费用/滑点与基准；不把回测收益当作实盘能力 |

建议第一条完整产品闭环是：**导入真实持仓 → 获取价格与事件 → 确定性风险计算 →
写明投资论点与检查条件 → 有变化再提醒 → 按当时信息复盘**。
在这条闭环稳定后，再决定是否增加估值模型、多 Agent 辩论或交易执行能力。

## 第一阶段闭环已落地

本轮增加证据记录与检索、结构化论点复核、持仓/观察名单保存、阈值变化提醒及确定性定时采集。
完整功能与执行流见 [项目功能与逻辑审计](marketbot_feature_logic_audit.md)，
操作样例见 [金融持续研究流程](finance_workflows.md)。
