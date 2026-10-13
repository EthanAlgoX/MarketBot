<!-- Modified for marketbot on 2026-10-13; see MODIFICATIONS.md. -->
# MarketBot 金融助手

面向股票与加密货币交易者的个人工作台。MarketBot 提供 Web、Electron 与 Expo 手机入口；独立 AI-Stock 服务负责金融数据与唯一模拟账本。助手负责订阅情报、每日归档和通知。

已进入开发实施。当前可用的是登录、私有金融工作区、自选维护、手工账户与模板交易导入，以及 RSS/Atom 来源、订阅样例预览、主题推荐、关联来源候选、日报快照、更正、反馈和站内通知。三个内置加密货币日线模拟规则已通过真实 BTC 行情验收，支持创建、启停、精确账本与归档输入追溯。研究任务、观察与规则草稿已有界面和受控接口，实际模型研究需配置和单独验收。当前项目不接入真实资金。

## 本地运行

源码仓库：[EthanAlgoX/MarketBot](https://github.com/EthanAlgoX/MarketBot)。从源码运行：

```bash
git clone https://github.com/EthanAlgoX/MarketBot.git
cd MarketBot
python3 scripts/bootstrap-financial-engine.py bootstrap
bash scripts/finance-dev.sh prepare
bash scripts/finance-dev.sh install-minimal
bash scripts/finance-dev.sh db-start
bash scripts/finance-dev.sh migrate
bash scripts/finance-dev.sh start
```

访问 [本地工作台](http://127.0.0.1:5181)，注册自己的账号。首个账号认领本地部署管理员，金融页面提供“创建金融工作区”入口。个人持仓、报告和模拟账户初始为空，需要后续录入或创建。

运行时、端口、停机、复建与备份命令见 [本地开发说明](docs/LOCAL_DEVELOPMENT.md)。开发密钥与数据库位于项目 `.local/`，不连接原 AI-Stock 数据库。当前开发配置只开放已验证的加密日线模拟，A 股模拟与模型研究分别关闭；通用助手保持离线集成运行配置。完整研究 SDK 已安装并通过导入验收，模型凭证、实际研究输出、股票行情和真机通知需要单独验收。

交易导入使用本项目 CSV 模板，先预览查重，再确认写入金融侧原记账账本。该账本沿用原 Float 存储；资金流水净额只统计入金减出金，可用余额和实时市值显示未知。它与新的 Decimal 模拟账本各自明确标识，不把手工记录当作券商同步。

## 文档

- [实施记录](docs/IMPLEMENTATION_LOG.md)：实际决策、接口、验证证据和未完成项。
- [本地运行验收](docs/LOCAL_RUNTIME_VERIFICATION.md)：真实服务、公开行情、源码复建和备份恢复证据。
- [实施任务清单](docs/IMPLEMENTATION_BACKLOG.md)：M0–M5 状态与依赖。
- [规划与设计方案](docs/PROJECT_PLAN.md)：产品流程、数据与运行政策。
- [系统架构](docs/ARCHITECTURE.md)：服务分工、数据归属和执行边界。
- [品牌规则](docs/BRAND_GUIDELINES.md)与[修改说明](MODIFICATIONS.md)：名称、公开展示和版权保留范围。

## 代码布局

```text
apps/web, apps/desktop, apps/mobile  多端界面
apps/api                           登录与受控业务 API
apps/worker                        订阅、日报、事件接收、移动投递
packages/contracts                 两端共用 DTO 和严格 RPC 输入
packages/core, packages/adapters    金融桥接、匹配与情报服务
packages/db                        助手 PostgreSQL、档案与 Inbox
services/financial-engine          固定版本的独立 AI-Stock 检出
integrations/financial-engine      可复现的金融源码补丁、清单与依赖
scripts                            项目专属运行和验收工具
```

手机与电脑共享服务端记录。关闭页面不会停止后台；电脑休眠、服务停止或网络断开仍会影响本地运行。默认先验证日线模拟，盘中策略和用户自己的首条策略按真实规则适配。
