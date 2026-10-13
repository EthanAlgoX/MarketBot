# 本地开发与验证

开发配置、密钥、进程记录和测试数据均放在项目自己的 `.local/` 下。金融服务完整环境使用 `services/financial-engine/.venv/`，私有桥接、自选管理和已验收的加密资产规则模拟使用单独的 `.minimal-venv/`；不会连接原 AI-Stock 的数据库。以下命令从本项目根目录执行。

## 运行时

MarketBot 基线要求 Node 22.22.2+（22.x）、24.x 或 26+，以及锁定的 pnpm 9.15.0。脚本优先使用项目局部运行时；`prepare` 可以找到 Codex 自带的兼容 Node，也可以通过 `FINANCE_NODE_BINARY` 指定已有运行时。需要安装 Corepack、PostgreSQL 16 的 `initdb` / `pg_ctl` / `psql` / `createdb` / `pg_dump` / `pg_restore`、uv，以及 Python 3.11 或 3.12。

当前已验证的组合是 Node 24.19.0、pnpm 9.15.0、最小环境 Python 3.12.14、PostgreSQL 16.14（完整 `.venv` 是 Python 3.11.15，完整依赖已安装并通过48个模块导入验收）。Graphile Worker 使用 PostgreSQL，不依赖 Redis。此阶段将通用电脑沙盒设为 `none`，无需 Docker。

```bash
python3 scripts/bootstrap-financial-engine.py bootstrap
bash scripts/finance-dev.sh prepare
bash scripts/finance-dev.sh install-minimal
bash scripts/finance-dev.sh db-start
bash scripts/finance-dev.sh migrate
```

`prepare` 只在 `.local/dev.env` 不存在时创建随机密钥，不覆盖已有配置。`install` 按上游锁文件安装 Node 依赖，在金融服务独立虚拟环境中安装金融依赖与测试工具。`migrate` 同时生成 Prisma 客户端和应用已经提交到源码中的数据库迁移。

`install-minimal` 使用根项目中固定的 `integrations/financial-engine/requirements-minimal.txt`。当前已实际验证桥接、公共 BTC 完整日线、三个内置 crypto 规则、Decimal 账本及工作区事件。完整 `.venv` 已另外通过研究 SDK 和原 `api.app` 的导入验收；导入不启动 lifespan，也不表示真实模型研究或 A 股实时来源已通过验收。存在 Codex 运行时时，独立 Python 3.12 环境通过 `--system-site-packages` 复用已有基础库并禁止 user site，固定清单覆盖已验证的金融直接依赖。启动脚本优先选 `.minimal-venv/`，可用 `FINANCE_PYTHON` 显式指定解释器。要准备完整金融研究环境，执行 `install`；它安装原仓库完整 `requirements.txt`，可能耗时较久。
PostgreSQL 的数据目录是 `.local/postgres/`，只监听 loopback；网络连接使用随机密码与 SCRAM，Unix socket 使用本地 trust。启动和停止前检查项目所有权标记。脚本不会启动、停止或更改系统已有 PostgreSQL 实例，也不会删除数据库。

## 服务

```bash
bash scripts/finance-dev.sh start
bash scripts/finance-dev.sh status
bash scripts/finance-dev.sh stop
bash scripts/finance-dev.sh db-stop
```

可以单独操作服务，例如 `start finance api` 或 `stop web`。进程日志位于 `.local/logs/`，进程记录位于 `.local/pids/`。停止前核对项目路径、PID、进程启动时间及进程组，只向脚本创建的服务发送终止信号。

| 服务 | 默认地址 | 数据与责任 |
|---|---|---|
| Web | http://127.0.0.1:5181 | 浏览器与桌面共同界面 |
| MarketBot API | http://127.0.0.1:3111 | 登录、投研桥接、助手侧数据 |
| Worker | 无公开端口 | Graphile 后台任务与事件消费 |
| 金融 API | http://127.0.0.1:8111 | 独立金融 SQLite、绑定与金融状态 |
| PostgreSQL | 127.0.0.1:55433 | 独立助手开发数据库 |

修改端口时，要同时调整 `.local/dev.env` 中对应 URL，例如 `API_PORT` / `API_URL` / `API_PROXY_TARGET`、`WEB_PORT` / `WEB_ORIGIN` / `BETTER_AUTH_URL`、`FINANCE_API_PORT` / `FINANCIAL_BRIDGE_URL`、`PGPORT` / `DATABASE_URL`。端口被其他服务占用时脚本会退出，不会接管它。

默认金融入口是 `api.internal.assistant_app:app`，组合相同的私有桥接路由和现有金融存储。显式启动会初始化项目自己的空控制库，不创建账号或工作区绑定；GET 查询不会建研究表。首个开发账号仍由你自行认领。自选管理命令使 `overview.capabilities.readOnly` 为 `false`，持仓、报告与模拟查询仍读取持久金融状态。

`FINANCIAL_SIMULATION_ENABLED=true` 时，入口只启动一个金融进程持有的日线模拟调度器，`/health` 会返回 `simulationSchedulerStarted: true`；关闭时为 `false`。此 gate 在真实公共 BTC 日线和三个原规则的隔离验收后才可开启。`FINANCIAL_CN_SIMULATION_ENABLED` 独立保持 `false`，A 股公共行情来源未做实际验收。`ASSISTANT_RESEARCH_ENABLED` 保持 `false`，尚未接入模型凭证和验证真实研究结果，能力仍明确报告关闭；不会生成伪造报告。`.local/dev.env` 是唯一开发配置来源，包括金融配置重新加载；`AGENT_RUNTIME=scripted` 保持通用助手的离线集成设置。

需要原金融API或模型研究时，在本项目`.local/dev.env`中设置`FINANCE_PYTHON`为完整`.venv/bin/python`的绝对路径。需要原公开金融API再把`FINANCE_ASGI_APP`设为`api.app:app`；完整依赖导入已通过，实际来源/模型结果仍须验收。该入口会恢复已有模拟并启动原工作区调度器，只能由一个进程管理独立数据库，不能和最小入口同时运行。改配置后通过脚本停止再启动本项目金融服务；保持研究gate关闭，直到实际受控研究验收完成。
## 验证

通过 `run` 使用项目局部 Node / pnpm 与开发环境，不要依赖终端里全局 pnpm 的版本：

```bash
bash scripts/finance-dev.sh run node --version
bash scripts/finance-dev.sh run pnpm --version
bash scripts/finance-dev.sh run pnpm --filter @marketbot/api check
bash scripts/finance-dev.sh run pnpm --filter @marketbot/web check
bash scripts/finance-dev.sh run pnpm --filter @marketbot/web build
curl --fail http://127.0.0.1:3111/health
curl --fail http://127.0.0.1:8111/health
```

本阶段金融测试使用 `services/financial-engine/.minimal-venv/bin/python`，测试自身应使用临时数据库，勿把 `.local` 的持久数据库当作单元测试 fixture。后端基本语法门禁：

```bash
cd services/financial-engine
PATH="$PWD/.minimal-venv/bin:$PATH" bash scripts/ci_gate.sh syntax
```

健康检查成功只验证服务可用。用户绑定、跨用户拒绝、模型调用、真实行情、设备推送和持续运行需要各自的验证记录。电脑端 Playwright 会打开真实 Electron 窗口，本机不执行；Web 的离线测试与构建可以执行。

真实服务集成验证使用专用随机 PostgreSQL 数据库和专用 SQLite，创建两个虚构账号，不占用开发数据库的第一次管理员认领：

```bash
bash scripts/finance-dev.sh run pnpm exec tsx scripts/verify-finance.mts
```

它验证登录、未绑定状态、运维 CLI 绑定、仅首管理员可自绑定、重复自绑定不更改工作区、金融查询、真实 Worker 事件消费、PostgreSQL Inbox / 通知 / 游标、重复事件去重、跨用户拒绝及已读反馈；同时验证自选添加/移除、命令状态、幂等重放与并发 revision 冲突。新闻验收使用真实登录 HTTP 验证来源 URL 限制、订阅来源归属、列表隔离、同日并发发布一次简报及通知、反馈归属、偏好保存、来源/订阅启停及 revision、日报覆盖窗口、显式更正 v2 与旧 v1 不变、推送状态字段。还验证关闭研究/模拟能力、UTC 预算与零模型调用，以及观察的登录和真实完成结果引用约束。新闻内容仅在一次性 DB 中标明为夹具，且先停止本次 Worker、禁止外部 feed 抓取；来源采集使用另外的离线 feed 测试。测试事件明确标记 `integration.test`，不代表成交。默认结束后停止其创建的进程、删除其临时 PostgreSQL 数据库，保留私有验证日志。

需要浏览器验收时，增加 `--keep --web`。随机账号和密码仅保存在本次 `.local/verify/<运行 ID>/access.json`（权限 600），控制台不会打印凭证。完成后执行以下命令，只清理该次验收：

```bash
bash scripts/finance-dev.sh run pnpm exec tsx scripts/verify-finance.mts --cleanup .local/verify/<运行 ID>
```

清理会核对目录归属、随机数据库名、PID 启动时间和进程组，不操作开发数据库或其他应用进程。

## 数据管理

日常重启使用 `stop` / `start`，保留 `.local` 数据。金融服务状态单独存在 `.local/financial-engine/stock_analysis.db`，助手侧状态在本项目 PostgreSQL 中。生产部署需要单独配置持久目录、服务凭证、HTTPS 和备份，不复用开发数据或开发密钥。两库联动恢复、事件游标核对和 72 小时运行验收见规划文档；此开发脚本不替代这些验收。


## 真实公共行情与模拟验收

```bash
bash scripts/finance-dev.sh run services/financial-engine/.minimal-venv/bin/python scripts/verify-market-source.py
```

该工具实际访问 Binance 公共只读日线，取 180 个已结束 UTC 日，验证连续、唯一、完整和有限的 OHLC 数据，保存原始 Decimal 价格及输入 hash。只有本次独立进程在来源通过后临时打开模拟 gate；新 SQLite 控制库/工作区不接触开发或原 AI-Stock 数据，执行三个内置 crypto 规则的最后四日，验证真实持久结果、成交和 `cash + marketValue = equity`。不调用模型或交易接口。证据在 `.local/source-audit/<ID>/`，失败记录实际依赖或 HTTP 状态，开发 gate 不变。

## 金融源码复建

上游 AIStock 基线固定为 `cec0078ca75aeb76ced28ae8bb0f1e22481d22d1`，金融源码在独立 Git 仓库中。根仓库交付 `integrations/financial-engine/overlay.patch` 与 `manifest.json`，包含修改和新增源码，排除所有虚拟环境、配置密钥、SQLite、日志及运行时。

```bash
python3 scripts/bootstrap-financial-engine.py bootstrap
python3 scripts/bootstrap-financial-engine.py verify
```

`bootstrap` 在新目录取固定上游 SHA 并应用 overlay，检查每个变更文件 hash；已有非匹配目录不会被覆盖。`verify` 从本机已拥有的固定 Git 对象离线导出到临时目录、实际应用补丁、核对 hash 并编译变更 Python，随后删除临时目录。开发者修改金融源码后重新生成交付物：`python3 scripts/bootstrap-financial-engine.py export`，再运行 `verify`。该导出只接受明确允许的源码/文档目录，不接受密钥、运行数据和 symlink。

## 一致备份与恢复验收

```bash
python3 scripts/finance-backup.py backup-and-verify
# 验证已有本项目备份：
python3 scripts/finance-backup.py verify --backup .local/backups/<快照目录>
# 确认完成后恢复开发服务：
bash scripts/finance-dev.sh start
```

备份先核对项目所有权和实际 PostgreSQL 数据目录，然后停止本脚本记录的 finance/API/Worker，保持 PostgreSQL 运行。若端口仍被未知服务占用，会退出。使用 `pg_dump` 和 `sqlite3_backup` 形成一致窗口快照，SQLite 的 committed WAL 通过备份 API 合入，不复制原 DB/WAL 文件。默认只包含 `.local/dev.env` 指定的开发数据库、控制 SQLite，以及控制库可信绑定推导的工作区 SQLite；不复制环境密钥。备份目录权限 700、文件 600，日志只在私有目录中。

恢复验收新建随机 PostgreSQL 数据库与 `.local/restore/<随机ID>/`，恢复快照并逐表核对数量/水位与 SQLite integrity_check，随后删除此次恢复数据库和目录。它不会覆盖运行库，备份及验收记录保留在 `.local/backups/`。初始开发库用户为零、绑定为零时，记录这一真实状态，不创造测试用户来占用首次管理员认领。72 小时真实持续试运行尚未完成。


对明确保留的隔离 Web 验收环境，可用同一工具验收已有真实绑定与模拟数据：

```bash
python3 scripts/finance-backup.py backup-and-verify --retained-verify .local/verify/<运行ID> --resume
```

该可选 scope 只接受本项目 `owner.json` 记录的随机 verify 数据库，核对来源控制 SQLite 路径位于该目录。暂停其已记录的 finance/API/Worker、保留 Web，完成独立恢复验收后 `--resume` 重启这些验证服务并更新 PID 身份记录；开发数据库不受影响。

实际源码与运行证据：初始开发库的 83 个 PostgreSQL 表和空控制 SQLite 已备份/恢复通过；实际公共 BTC 三规则的 source audit 与全部 12 个日结果及冻结输入，也已通过专用验证环境 authenticated HTTP 读取。持有工作区的完整备份恢复在验证环境进行，不将测试账户迁入开发库。

最终验收记录、实际来源/账本证据及持有工作区的备份恢复结果见 [LOCAL_RUNTIME_VERIFICATION.md](LOCAL_RUNTIME_VERIFICATION.md)。


## 完整金融 SDK 导入验收

完整环境安装了原 `requirements.txt` 的156个依赖；`uv pip check` 对158个已安装包检查通过。LiteLLM 1.105.0、OpenAI 2.54.0、tiktoken 0.11.0、Futu 10.8.6808、Longbridge 4.5.0 以及原分析队列、筛选服务和 `api.app` 已实际导入。该环境独立于正在运行的 `.minimal-venv`。

```bash
# 已验收的 macOS arm64 / Python3.11 固定环境，其他平台使用 engine requirements.txt：
uv --no-config pip install --default-index https://pypi.org/simple --python services/financial-engine/.venv/bin/python -r integrations/financial-engine/requirements-full-macos-arm64-py311.lock
uv --no-config pip check --python services/financial-engine/.venv/bin/python
python3 scripts/verify-full-financial-runtime.py
```

导入工具使用新的空 `ENV_FILE`、新审计目录和环境变量允许列表，不继承模型密钥；network transport 被禁用。它不启动原 API lifespan、不加载原数据库、不发送模型/行情/交易请求。实际48个模块导入成功，研究 capability 仍为 `research_disabled`。完整环境安装成功不改变 `.local/dev.env` 中的模型 gate；接入凭证和真实来源/结果验收另行进行。

## 新闻候选与样例预览验收

```bash
python3 scripts/verify-intelligence.py
```

新随机项目专用 PostgreSQL 库执行实际 migrations 与24项定向测试，完成后清理。新接口 `intelligence.previewSubscription` 只读已有缓存，返回 matched/excluded/review 样例和来源覆盖；`intelligence.list`/日报返回可解释候选分组，日报把分组及算法版本冻结到当时快照。旧数组日报不重写，`grouping=null`。规则、覆盖与当前不自动删除的留存策略见 [INTELLIGENCE_RETENTION.md](INTELLIGENCE_RETENTION.md)。
