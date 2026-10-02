# MarketBot 功能与 README 复现评测

评测日期：2026-10-03，Asia/Shanghai。对象：`codex/nanobot-finance-defaults` 开发分支。
本轮以 README 为可执行规范，先检查所有入口与功能逻辑，修复实现和文档，再从仓库外的
干净 wheel 环境重新执行。评测不外发消息，不操作交易账户，不改变用户已有配置。

## 结论

本地回归 **1272 / 1272** 通过；金融确定性验收 **15 / 15**；README 离线流程
**12 / 12**；干净 wheel 加公开数据的 README 流程 **13 / 13**。52 个 CLI help 入口、
中英 README 与集成指南中的 70 条命令参数完成核对。18 个原生金融工具与 12 个金融 MCP
工具均实际调用，成功、数据缺口、不可用和权限错误分别记录，未把“调用完成”计作“数据可用”。

本地及协议层的功能符合已说明的逻辑。公开行情能返回带来源的报价；闭市数据和未知时间
被保留并触发严格监控的数据缺口。免费新闻、基本面、筹码源存在无条目、限流或失败，
FRED 未配置 key。真实模型质量、平台账号收发、GPU 训练与 Docker 镜像运行未通过本轮
验证条件，不能宣称这些线上能力已经验收。

## 验收范围

| 功能 | 验收方式与结果 | 使用边界 |
| --- | --- | --- |
| 初始化、配置和诊断 | 实际 CLI 新建/刷新/状态；配置作用域、损坏文件和覆盖优先级回归通过 | 使用隔离配置，未覆盖真实用户数据 |
| Agent 循环、会话、记忆、子任务、路由 | 全量测试；实际 OpenAI 兼容 HTTP fixture → 工具 → 证据 → 回复 → session 回读通过 | fixture 测协议与控制流，未评测真实模型的研究质量 |
| 金融原生工具 | 18 个 CLI 工具实际调用；计算、事件、来源规划、逻辑图、证据、假设与监控验证通过 | 免费外部源不保证随时可用；规则信号是启发式结果 |
| 持仓计算 | 60000 CNY、20%股票冲击后50000 CNY、Decimal 0.02、缺FX拒绝均通过 | 用户输入价格和持仓；无券商持仓自动同步，无历史相关性或VaR计算 |
| 证据存储 | 完整payload、摘要、来源时间、派生链、并发、损坏存储与引用约束通过 | 原始来源准确性仍需交叉核对 |
| 假设复核 | confidence=0保留；文字不能证伪；伪造值、未知或过期时间拒绝；有效事实规则复核通过 | 显式规则与事实决定状态，模型文字不触发自动证伪 |
| 持续监控 | 基线、阈值、数量变化、权重、FX目标币、数据缺口、outbox/ack与调度管理通过 | 固定基线；FX和实际持仓需用户更新；投递至少一次 |
| 金融 MCP 与外部 MCP 客户端 | 真实 stdio 初始化/列举/调用；12工具只读；禁用后0工具；写操作拒绝；客户端超时/生命周期回归通过 | 12工具复用原生数据，不形成额外独立来源；Alpha Vantage未授权 |
| 技能与评分 | 63内置技能、搜索、兼容性、安装器与动态评分回归；113技能资产随wheel分发 | 外部安装需网络；评分衡量操作反馈，不是收益 |
| 情报 | 实际localhost HTTP RSS两条→重复采集去重→摘要存储/回读→计划管理通过；RSS/Atom/超时/未知时区回归通过 | localhost RSS为fixture；公开RSS是否可达取决于网络 |
| 原生Gateway与定时器 | 实际常驻、执行持久化native cron、SIGINT退出0；不支持的模型任务保留并明确拒绝 | 进程持续运行；无HTTP Gateway；finance-only不执行模型Heartbeat |
| 报告与Heartbeat | 实际公开数据报告保存在所选workspace；mock简报证据和Heartbeat模板写入通过 | 报告显示真实来源时间与过期/未知状态；模型Heartbeat执行未在线验收 |
| 提供商 | 18提供商配置/选择/错误处理测试，custom协议实测 | 无真实模型配置；OAuth状态为not_checked，不能作为登录证明 |
| 10聊天渠道 | 模块/构造器、消息总线与权限回归；Matrix extra干净安装通过；WhatsApp WebSocket鉴权/ack/广播通过 | WhatsApp平台后端为mock；全部真实渠道认证与送达未验收 |
| Browser、Lark、Twitter、小红书 | 工具适配器/配置/权限回归；四类CLI状态诊断；可移植wrapper检查通过 | 外部CLI和账号未配置；未做真实登录或写操作 |
| RL与OpenClaw | 实际CLI模拟→episode→dataset→两适配器导出→bundle→inspect；localhost环境及5指标HTTP路由通过 | 模拟价格/指标fixture；适配器当前只导出；无真实GPU训练 |
| 安装与部署 | 干净wheel仓库外复现；sdist含文档/示例/评测脚本；bridge干净npm/TypeScript构建通过 | 无Docker Engine，未构建运行完整镜像；Compose仅静态解析与构建步骤检查 |

## 本轮修复

1. 配置：增加全局 `--config/--workspace`，作用域在命令结束后恢复；显式损坏或不存在的
   配置不再回退到用户默认目录；报告和定时任务沿用正确的workspace。
2. 运行与调度：增加无模型 `gateway --finance-only`；金融计划支持查看/取消；修正
   cron默认值与间隔冲突、非法cron落盘、采集全部失败仍记成功以及摘要并发读取错误。
3. 数据逻辑：跨市场来源规划按市场分组；FX证据必须明确且匹配组合基币；报告区分抓取
   时间与行情时间，显示新鲜度；未知宏观值与规则解读有明确说明。
4. 采集与诊断：RSS改为带超时的异步HTTP取数和线程解析，不阻塞事件循环；无时区时间
   不冒用宿主时区；供应商异常仅输出安全类型；OAuth不再误报已配置；补齐Matrix和小红书状态。
5. RL与桥接：零仓位上限不再变成满仓；远程异常时清理lease；移除旧个人电脑路径；
   WhatsApp依赖提示与实际Node20契约一致，桥接失败正确返回非零。
6. 分发：wheel不再包含本机 `bridge/node_modules`、dist和平台动态库；仅打包6个bridge
   源码资产；保留用户Cookie排除；sdist补齐README依赖的文档、示例、脚本和测试。
7. 文档与持续验证：重写中英README，提供无需模型的首次成功流程、可运行JSON例子、
   模型配置、可选集成和能力边界；新增README黑盒脚本与CI，并明确绑定Python矩阵版本。

## 可复现证据

- [README回放结果](evaluation/readme_walkthrough_2026-10-03.json)：干净wheel、真实CLI、
  localhost协议fixture与公开源探测，共13组通过。实际行情时间保存在报告内。
- [金融场景结果](evaluation/finance_acceptance_2026-10-03.json)：15个确定性逻辑案例。
- [原生金融与MCP实测](evaluation/native_finance_acceptance_2026-10-03.json)：逐工具可用性及数据缺口。
- [扩展与部署验收](evaluation/integrations_acceptance_2026-10-03.json)：RL、HTTP、bridge与可选依赖。
- 本地完整回归：`pytest -q tests`，1272 passed。Ruff与`git diff --check`通过。
- 最终代码wheel包含163个Python文件、113个技能资产、4个workspace模板和6个bridge源码
  资产；源码逐文件比较一致，无node_modules、编译bridge、动态库、pycache或Cookie。

```bash
python -m pytest tests
python scripts/evaluate_finance.py --output .local/finance-evaluation.json
python scripts/evaluate_readme.py --output .local/readme-evaluation.json
python scripts/evaluate_readme.py --python /ABSOLUTE/FRESH_VENV/bin/python --network --output .local/readme-wheel-evaluation.json
```

`evaluate_readme.py` 在临时目录运行 CLI，选定Python解释器，移除继承的PYTHONPATH并仅用
本地LiteLLM元数据；无需模型账号。`--network` 另执行公开行情/新闻/宏观与报告源调用。
额外通过临时socket审计限制离线CLI，12组通过且非回环DNS/连接尝试为0；故障注入时12组均失败、退出码1并清理临时目录。离线模式不会把默认报告命令当作离线能力，因为它会请求补充数据。金融quote mock、RSS
和模型fixture明确标记；测试中加速的1秒cron只用于协议执行验证，文档调度仍以分钟为单位。

未配置的线上项需后续在用户自己的账号与环境下验收；它们不属于本轮“全部正常”的结论。
