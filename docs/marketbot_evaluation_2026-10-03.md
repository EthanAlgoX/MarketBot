# MarketBot 开发评测记录

评测日期：2026-10-03（Asia/Shanghai）。代码从 MarketBot main `4faa7fd` 开始，
参考 Nanobot main 已更新到 `ae1eb02cd8a1266ea9912c048893310a28e9d9fe`；保存旧快照。
结果数据见 [验收 JSON](evaluation/finance_acceptance_2026-10-03.json)。

## 结果

| 检查 | 实际结果 | 验证范围 |
| --- | --- | --- |
| 全量 Python 回归 | **1181 passed，50.27s** | Python 3.12.13；仅 Git 跟踪文件的干净副本，含旧功能与新金融流程、会话、渠道 mock、计划、MCP、RL |
| 金融场景验收 | **15/15** | 确定性 Decimal/FX/现金/压力、证据检索、论点伪造/时效检查、阈值与 outbox |
| 实际 AgentLoop | 通过 | 脚本模型响应 → 工具 → 完整数值/证据 → 最终回复与会话保存；不代表真实模型质量 |
| Ruff / diff | 通过 | 全部 marketbot、tests 和金融验收脚本；无空白错误 |
| wheel / sdist | 通过 | **163** Python 文件、**113** skill 资产、**4** 模板，均无缺失；登录 Cookie 未打包 |
| 独立安装 | 通过 | 新 venv、源码目录外；CLI/MCP help、初始化、RL/Agent/evidence/watch imports、真实 CLI 计算与存证 |
| 已安装 wheel 的实际 stdio MCP | 通过 | 初始化、**12** 个只读工具、0.1×0.2=0.02、检索原始 evidence |
| 公开行情接口 | 4/4 返回，无遗漏/警告 | SPY、600519、0700.HK、BRK.B；CN/HK实际时刻保留，US未知时区保留缺口 |
| 存储与边界 | 通过 | 线程/进程竞争、损坏/未来schema不覆盖、原子写入、陈旧快照拒绝、cache副本、NaN/Inf/路径等 |
| 凭据检查 | 通过，新增模拟凭据被拒绝 | hook 扫描 Git 跟踪文件；39 个基线候选经核查为测试夹具、示例、公开常量或代码表达式；小红书 Cookie 保留本地并移出版本控制 |

## 已修复问题与复测

功能/逻辑清单及每项确认问题见 [项目审计](marketbot_feature_logic_audit.md)。
除金融闭环外，本轮修复影响已有执行路径的会话隔离、TLS 降级、计划证据传递、非法数值、
宏观 CPI 单位、定时任务损坏/竞争和安装资产丢失问题。对应失败触发均有回归或安装验证。
Cron 并发保存冲突后保留新定义、重新加载/设下次时间；发现坏文件则显式停止并保留原文件，避免忙循环或覆盖。

提交后追加复测发现 SQLite 临时日志的路径检查竞态：改为单次 `lstat`，保持链接/非普通文件拒绝，
真实线程/进程两种并发用例重复 10 轮通过。Watch 修复空库被初始化、链接越界、首次并发建库问题；
80 项 Watch 测试、150 项金融联动测试及最终干净副本全量回归通过。
凭据 CI 使用返回非零的 hook 门禁，单独验证了新模拟凭据使检查失败；移除已跟踪的 Python 编译缓存。
CI 保留 JUnit 汇总和失败注释，便于定位远端环境差异。
远端随后确认两个既有 RL/OpenClaw CLI 用例因窄终端拆开路径文件名而失败；修复路径硬折行及 Rich 标记解析，
保留完整原始路径，并用 12/20 列终端和带方括号的长路径做确定性复测。

## 评测边界

- 本机没有 MarketBot 模型账号配置；没有评测真实 LLM 的研究质量、幻觉率、指令理解和成本。
- 真实聊天平台、Alpha Vantage/FRED/TickFlow 账号接口和 GPU/OpenClaw 训练未进行在线验收；mock/协议/错误分支测试通过。
- 没有声称 Docker/Windows/所有 Python 版本的本地实机验证；GitHub CI 配置 Python 3.11/3.12/3.13 与安装检查，远端结果需另看。
- 公开报价 smoke 只证明当前请求与解析可执行，不验证供应商准确性/授权/完整交易时间；时区未知的美股数据不用于严格时效规则。
- 15 个案例使用演示夹具，不是投资收益回测；没有验证有效 alpha、投资适当性、执行交易或金融业绩。
- 外发告警保持至少一次语义：入队不自动 ack，当前运行内去重，重启重投稳定 ID；远端成功回执尚未统一实现。
- 小红书 Cookie 从当前版本移除不能清除历史提交中的旧登录态，建议注销对应会话。

上述可复现的软件与金融计算验收通过，可提交开发分支；真实模型/平台质量仍须配置对应环境后单独验收。

## 重现命令

```bash
uv sync --extra dev
uv run pytest -q
uv run ruff check marketbot tests scripts/evaluate_finance.py
uv run python scripts/evaluate_finance.py --output .tmp/finance-evaluation.json
uv build
```
