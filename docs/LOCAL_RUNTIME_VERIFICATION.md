# 本地运行与复建验收记录

验收日期：2026-10-12（Asia/Shanghai）。所有操作针对新项目 `.local` 和专用随机验收数据库，未使用原 AI-Stock 数据或用户模型凭证。

## 当前开发栈

Web `http://127.0.0.1:5181`、API `http://127.0.0.1:3111`、金融桥接 `http://127.0.0.1:8111` 均返回 HTTP 200；Worker 和独立 PostgreSQL 正在运行。金融新 lifespan 的 `/health` 返回 `processOwnerStarted=true`、`simulationSchedulerStarted=true`。

实际检查开发库：用户 0、Space 0、金融绑定 0、事件 Inbox 0。没有占用第一次管理员认领。

| 能力 | 开发配置 | 验收边界 |
|---|---|---|
| 自选、模板记账、新闻预览、日报归档与更正 | 可用 | 真实 HTTP、真实公共 RSS、归属与重放测试 |
| 加密资产日线规则模拟 | `FINANCIAL_SIMULATION_ENABLED=true` | 三个内置规则通过真实公共 BTC 数据与持久账本验收 |
| A 股模拟 | `FINANCIAL_CN_SIMULATION_ENABLED=false` | 规则与日历测试通过，实际公开 A 股来源尚未验收 |
| 模型研究/筛选 | `ASSISTANT_RESEARCH_ENABLED=false` | 完整 SDK 导入已验收；凭证及真实研究结果未验收，预算、源调用与停机护栏已测试 |
| 实盘交易 | 关闭 | 无交易所/券商下单调用 |

开发环境启动记录在 `.local/development-startup-verification.json`。72 小时真实持续试运行尚未完成。

最新源码冻结后受控重启finance/API/Worker，Web/PG保留；全部health200，金融processOwnerStarted=true。用户/Space/绑定/管理员认领/Inbox仍为0，gate为crypto=true、CN=false、research=false。最终证据`.local/development-final-verification.json`，全流程汇总`.local/final-runtime-summary.json`。

最终相关Node验收43文件502项，新增缺失快照与空仓区别测试后累计503个唯一用例；新增后另跑Finance/ManualPortfolio两文件16项及API金融两文件8项，均通过。完整Turbo检查22个类型/生成任务通过；最后API/Web/mobile类型与Web构建再次通过。所有真实PG单测使用新随机库并结束清除，汇总`.local/intelligence-audit/finance_intelligence_cd189b8de711032f/final-node-summary.json`。

## 来源与实际金融结果

执行命令：

```bash
bash scripts/finance-dev.sh run services/financial-engine/.minimal-venv/bin/python scripts/verify-market-source.py
# 同一实际公共来源经专用登录 HTTP 创建及读取：
bash scripts/finance-dev.sh run services/financial-engine/.minimal-venv/bin/python scripts/verify-market-source.py --retained-verify .local/verify/6df442ed6358385e
```

实际获取 Binance Spot BTCUSDT 的 180 个完整 UTC 日（2026-04-14 至 2026-10-10），连续、唯一、非未来日，并保留 provider Decimal 价格。输入 CSV SHA-256：`44103ca97c838265fa7035ccdf5002e32091b3ae4cbc40f6081801500ad700be`。

三个原规则 `crypto_btc_hold`、`crypto_equal_weight`、`crypto_rotation` 各执行最后四日；每个产生一笔实际模拟成交，检查持久结果记录、原始冻结行情与精确 `cash + marketValue = equity`。没有 mock 决策/成交/持久化，没有模型调用或实盘交易。三者使用同一个 BTC 单标的，因此这不是多标的轮换收益验收。

证据：`.local/source-audit/d0354d08006ae18d/result.json`（独立金融工作区）和 `.local/source-audit/229f0bba130604bf/result.json`（专用 HTTP 环境）。后者完成 run 1/2/3、12 个日结果和 12 次冻结输入查询的真实 DTO 解析。浏览器另对 paper run 4 验证 create/start/pause/resume/stop，未产生成交。

## HTTP、预算与进程生命周期

```bash
bash scripts/finance-dev.sh run pnpm exec tsx scripts/verify-finance.mts
```

最终 19 项真实服务验证通过，证据 `.local/verify/810786710578b4a1/result.json`。覆盖登录/跨用户隔离、owner 自绑定及禁止非 owner 自绑定、服务凭证拒绝、自选命令幂等与 revision、真实 Worker 消费/Inbox/游标、来源 URL 与订阅归属、来源/订阅启停、偏好、日报覆盖与更正、旧快照不变、反馈及投递状态字段。关闭研究能力时预算为 UTC、模型调用为零；观察只能引用真实已完成研究，缺失结果不能保存。

金融组合回归最终238项通过，包括手工原账本混币拒绝、预算并发预留、未知usage不退款、三处原模型调用和实际DataFetcher源操作护栏、timeout/并发上限、停机后旧SDK不可settle，以及原history/screening提交的owner fence。实际lifespan测试验证独占进程锁、启动恢复interrupted、不自动重送、丢库不创建、异常rollback释放锁。源次数单位为provider operation，不宣称逐个计数SDK内部网络请求。完整模型研究SDK已独立安装并通过导入验收，仍未接入模型凭证或生成研究报告。

## 固定源码复建

```bash
python3 scripts/bootstrap-financial-engine.py bootstrap
python3 scripts/bootstrap-financial-engine.py verify
```

固定公开上游 SHA `cec0078ca75aeb76ced28ae8bb0f1e22481d22d1`，根仓库保存 35 个修改/新增金融源码文件的 overlay 与逐文件 hash。实际验证了离线导出/apply/hash/编译，以及新随机目录联网 fetch 固定 SHA、应用补丁、核对文件；验证副本随后删除。证据 `.local/source-replay/network-bootstrap-verification.json`。交付物不包含 `.local`、环境密钥、数据库、日志或虚拟环境。

混币修复冻结后，35文件overlay已export/verify，实际重放/hash/compile通过。2026-10-13仅更新金融说明文档的产品展示用语后再次导出/重放，当前patch SHA-256为`30e2971ee49a77b84605816a45c8f55778d43b691365b7e635f2a3b42237ad43`。

## 一致备份与恢复

```bash
python3 scripts/finance-backup.py backup-and-verify
python3 scripts/finance-backup.py backup-and-verify --retained-verify .local/verify/6df442ed6358385e --resume
```

两轮实际通过：初始空开发控制库，以及持有真实数据的专用验收环境。后一备份为 `.local/backups/20261011T180656Z-9a494e0a`，包含 83 个 PostgreSQL 表、控制 SQLite 与 2 个可信工作区 SQLite。金融工作区含 4 个模拟账户、12 个已持久化日结果、事件水位 13；助手侧 Inbox/游标水位同为 13，日报 v1/v2 均保留。

最新增量备份`.local/backups/20261012T020753Z-32b2e79d`再次随机恢复通过，包含迁移100后的84个PostgreSQL表及3个SQLite。原4个模拟账户之外增加2个手工账户、4笔交易/4条导入审计与2笔入金；12个模拟日记录、3成交、cursor/Inbox13与日报v1/v2快照hash保持一致。恢复目标已删除，专用验证写服务随后恢复，真实登录overview=ready、eventSync ready/cursor13/lag0，API与金融health200。

备份停止且等待已验证的 finance/API/Worker 整个进程组退出，保留 PostgreSQL；通过 `pg_dump` 和 SQLite backup API 读取已提交状态，不复制运行中的 WAL 原文件，也不复制密钥。目录 700、文件 600。恢复只在新随机 PostgreSQL 数据库和新 restore 目录中进行；逐表数量/水位一致，SQLite integrity_check 通过；恢复目标已删除，验收记录和私有备份保留。

验收环境随后启动最新共同 owner/fence，真实 HTTP 确认 run 1/2/3 保持 completed、各四日，crypto gate 开放、CN/研究关闭；原开发数据没有被恢复库覆盖。重新启动记录位于 `.local/verify/6df442ed6358385e/post-backup-readiness.json`。


## 完整 Python 环境与新闻增量

完整 `.venv` 的 Python3.11.15 安装原 requirements 的156个依赖，耗时约11分钟（含公开 wheel 下载和6个源码包构建），没有改写原依赖范围。`uv --no-config pip check --python services/financial-engine/.venv/bin/python` 检查158包兼容，macOS arm64/py311版本冻结到 `integrations/financial-engine/requirements-full-macos-arm64-py311.lock`。

`python3 scripts/verify-full-financial-runtime.py` 实际48个模块导入通过，包含研究 LiteLLM/OpenAI/tiktoken、行情与券商 SDK、原 AnalysisTaskQueue/ScreeningService 及 `api.app`。新的空 ENV_FILE 与凭证环境允许列表确保不使用原配置；网络 transport 被阻断，实际 network attempt 0、model call 0、交易 call 0、lifespan 未启动、研究仍 `research_disabled`。证据 `.local/full-runtime-audit/599626193a5f5a8d/result.json` 和私有 install/import 日志。没有切换现运行 minimal 金融服务或修改开发 gate。

`python3 scripts/verify-intelligence.py` 在新随机 PostgreSQL 库实际部署最新迁移，6 files/24 tests 通过后删除该库；证据 `.local/intelligence-audit/finance_intelligence_e60b7db15582e9f4/result.json`。新覆盖缓存真实样例三态/来源隔离、未采集与失败状态、100修订有界扫描与最新修订选择、精确链接/同UTC日精确标题候选、已存分组快照不重算与旧数组兼容。候选没有语义同事件或因果承诺。详见 `docs/INTELLIGENCE_RETENTION.md`。限定 contracts/core/adapters/API TypeScript 检查通过；没有编辑 UI 或新增数据库表。

另已对开发库和保留53712验证库执行 migration100；保留两版日报 snapshot hash与数量前后一致，实际金融库仍保留4账户、4运行、12日结果/权益快照及3成交。证据 `.local/migration100-verification.json`；此过程没有创建开发用户。

手工记账后端冻结后，已再次 export/verify 最新35文件 overlay（包含新增 service/tests/docs），真实基线重放/hash/compile通过。保留53712金融桥接按自身PID/PGID重启，共同owner health为true，证据 `.local/verify/6df442ed6358385e/manual-readiness.json`。随后API/Worker也按同一环境owner记录重启到最新源，既有新闻和模拟档案保留。


最终238项金融回归命令（实际执行53.35秒）：

```bash
cd services/financial-engine
.minimal-venv/bin/python -m pytest tests/test_assistant_manual_portfolio.py tests/test_assistant_lifecycle.py tests/test_assistant_research.py tests/test_assistant_bridge.py tests/test_assistant_simulation.py tests/test_assistant_finance_audit.py tests/test_stock_list_parser.py -q
```

最终API/Worker也按保留环境owner进程记录重启至最新源，金融进程未重复重启。真实Alice原cookie的 `POST /rpc/finance/overview` 和 `intelligence.previewSubscription` 均200；后者读取15条已有公开RSS缓存样例。证据 `.local/verify/6df442ed6358385e/api-worker-readiness.json`。保留环境的 `start` 是静态源码启动；后续handler改动必须由该进程owner重启才生效。

冻结最新core bridge后，专用API再次按owner记录重启；四类公开命令回执查询对未使用key均实际返回200/null（手工记账、自选、模拟、研究），没有提交命令或模型任务。证据 `.local/verify/6df442ed6358385e/missing-receipt-verification.json`。

## 手工记账真实 RPC 验收

实际使用保留环境两个虚构账号，创建手工现货账户并记录1000 USDT入金，导入BTC买入0.001（80000，手续费0.1）与卖出0.0005（81000，手续费0.1）。原金融账本持仓为0.0005，资金流水净额为1000.0，可用余额和实时市值均null；净额不含交易支出。全部输入金额为字符串，但原存储仍Float，不将其精度等同新的模拟账本。

最终20次公开HTTP调用，其中18个成功响应均通过实际共享Zod契约解析；覆盖创建与回执重放、入金、预览/导入/重放、再次导入两行重复跳过、原编号改内容冲突、Bob读取Alice账户404、伪造owner字段400、真实缓存订阅预览以及模拟水位仍13。证据 `.local/manual-rpc-audit/bd33474837f54702/result.json`。之前验收尝试的失败记录保留；其中金额文本的1000.0/1000比较已改为Decimal相等，未修改账本数据或把失败记录当成功。

保留环境现在多出两个匿名手工账户，每个有两笔交易与一笔入金；原三个真实BTC模拟与日报v1/v2仍保留。开发环境没有导入这些验收账号或记录。

最后兼容性回归通过原PortfolioRepository写入混币现金/交易或异市场交易/公司行为，确认读取明细、预览、新导入和新资金记录均409 `portfolio_ledger_currency_conflict`，原账本/回执数量与修订不变，旧幂等回执仍可查询和重放；这5项不在保留或开发库插入异常记录。手工记账组合22项全部通过（13.90秒）。
