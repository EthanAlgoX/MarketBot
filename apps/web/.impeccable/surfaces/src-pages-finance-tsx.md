---
version: 1
slug: "src-pages-finance-tsx"
primary_target: "src/pages/Finance.tsx"
related_targets: ["src/pages/finance/ResearchPanel.tsx","src/pages/finance/SimulationControls.tsx","src/pages/finance/IntelligencePanel.tsx","route:/app/finance"]
---

# Financial workspace

## Scope and mode

Operate；`/app/finance` 及其新闻、研究、模拟和服务状态分区。与现有助手壳层及外观偏好衔接，使用已存在的 MarketBot 单色、Geist 和 Base UI 组件体系。

## Audience and job

个人股票与加密资产交易者。先检查关注资产、新闻、服务与运行状态，再按需阅读研究、保存观察笔记、调整订阅或管理日线模拟。

## Actions and proof

总览、自选、持仓、研究、模拟策略与服务状态通过真实服务读取；新闻区包含推荐、日报归档、信息源、订阅缓存预览与关联来源候选。新闻显示作者、匹配原因、原文时间和首次发现时间；归档显示日期、时区、版本、窗口、数量、更正及冻结分组。研究保留任务结果及用量，观察记录保存当时判断/手工失效条件，规则草稿保存不运行；模拟保留来源、交易日、精度与订单/成交引用。手工账户先预览/查重再提交模板交易，明确Float精度与未知可用余额；缺失持仓快照不显示空仓结论。新增流程沿用已有控件、渐进展开和局部表格滚动，不增加新的视觉token。

## Direction and responsive behavior

继承 incumbent 操作界面。页面名称和导航提供定位，模块标题后接行列表或表单；报告、冻结规则、研究输出和更正操作按需展开。窄屏把多列表单顺序堆叠，工具栏换行，导航和表格在局部滚动。可记住的体验是同一条信息从发现、推荐到日报和复盘时仍保留其来源、时间与版本。

## States and constraints

空账户、无匹配新闻、研究未启用、服务断线与上次读取结果分别呈现。不存在真实研究或策略时不创建演示收益。新模拟操作按服务能力与规则目录决定，历史精度单独提示；运行中操作的超时恢复查询同一操作结果。金额以服务返回的十进制字符串和币种呈现，收益和风险指标为派生估算。保存观察笔记不自动执行交易。

## Evidence and unresolved validation

代码与 `output/playwright/finance-*-desktop.png`、`finance-*-narrow.png` 支持 Web 浅色实现记录；本 brief 不宣称深色、Electron 或原生真机视觉验收。实际个人策略、模型配置、推送设备与连续运行验收仍需后续验证。产品范围以 PRODUCT.md 和根目录规划为准。
