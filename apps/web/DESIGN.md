---
name: "marketbot"
description: "采用共享语义视觉系统的个人金融工作台"
colors:
  primary: "#f1f1ef"
  primary-foreground: "#0b0c0e"
  background: "#0b0c0e"
  foreground: "#ececee"
  card: "#141518"
  secondary: "#18191e"
  muted-foreground: "#85858a"
  border: "#1e2026"
  input: "#18191e"
  ring: "#3b82f6"
  link: "#3b82f6"
  destructive: "#ef4444"
  success: "#4ecb71"
  warning: "#e9c46a"
  light-primary: "#1a1a1a"
  light-primary-foreground: "#f1f1ef"
  light-background: "#fafaf8"
  light-foreground: "#1a1a1a"
  light-card: "#ffffff"
  light-secondary: "#f0f0ed"
  light-muted-foreground: "#6c6c70"
  light-border: "#f0f0ed"
  light-input: "#eaeae6"
  light-ring: "#6c6c70"
  light-link: "#2563eb"
  light-destructive: "#dc2626"
  light-success: "#228b3b"
  light-warning: "#b7791f"
typography:
  headline:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.75rem"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.5rem"
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  reading:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.75rem"
  label:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  label-small:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
  metadata:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
rounded:
  sm: "0.5rem"
  md: "0.625rem"
  lg: "0.75rem"
  xl: "1rem"
  4xl: "2rem"
spacing:
  base: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  5: "1.25rem"
  6: "1.5rem"
  8: "2rem"
  10: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
    width: "100%"
  badge-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.label-small}"
    rounded: "{rounded.4xl}"
    padding: "0.125rem 0.5rem"
    height: "1.25rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "1rem"
  finance-navigation-selected:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
  finance-news-row:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.reading}"
    padding: "1.25rem 0"
---

# Design System: marketbot

## Overview

**Creative North Star: "金融工作台"**

采用项目的单色操作界面：Geist 文本、语义色、轻边界和渐进展开。界面让用户读取来源、检查状态并完成明确操作，视觉层级来自内容顺序、字重和留白。

同一套 Web 页面服务浏览器与 Electron；金融工作台的窄屏 Web 保留相同内容层级。原生 Expo 使用共享颜色语义和系统控件，平台导航与触控规范在原生实现中决定，本文的 Web 尺寸不能直接移植为原生尺寸。

**Key Characteristics:**

- 单色主操作与语义状态色。
- 行列表、分隔线和展开详情构成信息层级。
- 浅色、深色沿用同名语义 token。
- 金额、业务日期、来源和数据质量保留各自含义。

本文记录已实现的视觉系统，来源为 `packages/ui-tokens/src/index.ts` 及其生成 CSS、`packages/ui-web` 的组件、`apps/web/src/styles.css` 与金融路由。截图证据来自 `output/playwright/finance-*-desktop.png` 和 `finance-*-narrow.png`；它们支持 Web 当前浅色界面记录，不能据此宣称深色、Electron 或原生真机已完成视觉验收。前台状态与后台能力的记录以实现为准。

## Colors

主操作为黑白对比，内容与容器由接近中性的语义色区分。前置 token 中无前缀的颜色对应生成 CSS 的默认深色值，`light-` 为浅色映射。运行时使用语义 CSS 变量，并由现有外观偏好选择主题；不要从本文拷贝快照颜色到业务组件。

### Primary

- **primary / primary-foreground**：主按钮的底色和前景；浅色为深色按钮，深色为浅色按钮。
- **ring**：键盘焦点边框与外圈。它是交互反馈，不是金融品牌色。
- **link**：共享链接语义色。金融新闻标题实际继承正文颜色，以 hover 下划线表明链接。

### Neutral

- **background / foreground**：全页底色和主文字。
- **card**：表单、错误区域和通用容器的表面。
- **secondary**：选中的页内导航和次要按钮。
- **muted-foreground**：来源、时间、说明和辅助标签；不用于替代正文。
- **border / input**：列表分隔线、表格边界与输入框边界。应用保持轻边界，避免用高对比线框包装每段内容。

`destructive`、`success`、`warning` 是共享状态色，分别服务错误、成功和警示。金融页实际以 destructive 标示读取或任务错误，以 warning 标示数据陈旧、待核实或历史精度提示；状态旁仍保留文字。不要添加一套独立的涨跌配色来改变这些语义。

**The Semantic Slot Rule.** 相同 token 在 Web、Electron 和原生自定义表面保持相同用途，边框色不被拿来代替容器底色。

## Typography

**Body Font:** Geist Variable，后备为 ui-sans-serif、system-ui、sans-serif。

**Character:** 使用单一无衬线字体完成导航、表单和阅读。字重、尺寸和行距区分任务层级，金融数值使用等宽数字排布；未引入独立展示字体。

### Hierarchy

- **Headline**：页面名称，半粗体与紧凑高度。
- **Title**：模块标题，半粗体；条目标题常使用中等字重。
- **Body**：字段值与操作说明；Web 输入在窄屏保留基础字号，宽屏沿用小号 UI 字号。
- **Reading**：新闻摘要和展开报告，较宽行距；正文容器使用现有 `max-w-prose`，长内容换行。
- **Label**：中等字重的按钮和字段名称，标签与控件绑定。
- **Metadata**：来源、版本、数据时间和服务提示，使用辅助文字色；存在关键异常时另有明确状态文字。

**The Financial Value Rule.** 金额与数量直接呈现服务返回的十进制字符串，以等宽数字对齐并带币种；客户端不把不同币种相加。收益率、回撤和风险统计按派生指标呈现，样本不足时保留空值。百分比换算只用于标明比例的派生值。

## Layout

金融工作台占满宿主高度，页面名称与刷新位于固定区域，页内导航位于下方；主内容独立纵向滚动。中央容器上限为现有宽度（72rem），窄屏横向内边距（1rem）、宽屏内边距（2rem）。页面上下留白与模块间隔按前置 spacing 刻度实现。

桌面表单在小断点以上按两列排列；窄屏依次排列字段，工具栏和状态行允许换行。金融页窄屏按钮最低高度（2.75rem），具体样式继续使用通用按钮组件。导航的横向滚动限制在导航条内，表格的横向滚动限制在表格容器内；不要靠缩小金额字体使表格硬塞入屏幕。

列表用上下边界与条目间分隔线组织信息。新闻、报告、模拟运行和通知不全部套入卡片；只在表单、空状态、需要边界的容器和通用组件中使用圆角表面。较长研究输出、运行规则和操作详情逐步展开。

此布局描述金融工作台已完成的表面；其他助手路由沿用自身已存在的布局。路由的任务和状态约束保存在 `.impeccable/surfaces`，不把一页构成强制推广至全部页面。

## Elevation & Depth

金融页主要依靠中性表面与分隔线建立深度。通用 Card 使用前景色低透明度的一圈边界；输入和按钮聚焦时显示 ring。共享 Dialog 的遮罩与弹出表面使用 Base UI 生命周期、短暂淡入和缩放；金融列表无需额外阴影或装饰背景。实际阴影、焦点圈和动画片段在 sidecar 中保存，前置 token 不添加不受支持的类别。

共享按钮沿用默认状态过渡，按下时小幅下移；加载只反映真实请求。现有 CSS 对头像和 shimmer 的 Reduce Motion 规则保持有效，金融页没有新增装饰性循环动画。

**The State Depth Rule.** 聚焦、展开和请求状态解释深度变化，金融内容本身保持可读。

## Shapes

现有 radius 为轻圆角体系：小圆角用于摘要和局部交互，按钮及输入用大圆角，容器与空状态用更大的圆角。徽标沿用现有大半径形成紧凑标签。边框、圆角和内部空间保持共享组件定义；不另造金融专用控件外形。

## Components

### Buttons

主按钮承载归档或创建等明确动作；secondary 承载采集、刷新和选择；ghost 承载导航、反馈和辅助动作。通用默认高度（2rem）、横向内边距（0.625rem）在金融窄屏按布局要求扩大触控高度。focus-visible 使用 ring 边框和外圈，禁用态半透明且不可触发；错误字段和操作保留 aria-invalid 或明确 alert。

### Inputs / Fields

沿用 Base UI Input、原生 select 包装和 textarea；标签置于控件上方，焦点明确。长观察笔记用多行输入，JSON 和完整技术结果置于可展开区域。禁用研究服务、预算阻塞及未启用模拟能力时，表单解释当前原因，不显示成功结果。

### Chips

Badge 用于只读、质量等短标签。页内选项使用真实按钮和 aria-pressed，选中态为 secondary。反馈“已读”“有用”“不相关”显示已保存的选择，不把所有推荐自动标为已读。

### Cards / Containers

共享 Card 有表面、低对比边界和模块内边距。金融列表以行结构为主；空状态的 muted 半透明表面给出下一步。连接未配置、未绑定、无法读取、有连接但无数据各有对应内容；读取失败不会把已有数据误置为全新空账户。

### Navigation

金融工作台页内导航包括总览、新闻与日报、持仓、研究、模拟策略、服务状态。新闻区再分推荐、日报归档、信息源与订阅。文字导航保持原有字重、选择底色与键盘焦点；窄屏保留局部横向滚动。Electron 的可拖拽标题区域与可操作控件明确分开。

### Financial records

- 新闻行同时呈现来源、作者、原文发布时间和首次发现时间；时间未知时明示。设备时区显示新闻时间；日报版本显示其保存的时区、覆盖窗口、总匹配数、截断状态和更正原因。
- 研究任务保留状态、当时结果、模型可见输出、失败原因、已核实用量和待核实预留。价格未知只显示用量。观察笔记保存当时研究摘要、个人判断和有效期，不展示未产生的结果。
- 模拟记录保留运行规则、输入来源、交易日、记录标识、订单/成交标识及账本精度。历史账本提示单独存在；新模拟入口按服务能力和规则目录决定。没有当日成交时显示事实，不用推测成交填充。
- 通知区区分站内记录、推送受理、无设备、待核实、失败及已读；记录时间不替代业务交易日。
- 服务状态用成对标签/值显示金融服务、同步进度与精度；断线、恢复需求和陈旧数据保留明确文字。

## Do's and Don'ts

### Do:

- **Do** 使用共享语义 token 和现有 Base UI 组件；新增金融页面继续遵循同一层级。
- **Do** 让金额保持服务返回的十进制字符串，并显示币种、空值和精度状态。
- **Do** 将新闻原文时间、首次发现时间、日报归档时间分开呈现；日报版本及覆盖窗口可检查。
- **Do** 对读取失败保留上次内容并标示陈旧状态；关键操作提供结果查询与同一操作重试。
- **Do** 在窄屏保留可阅读内容、触控高度和局部横向滚动；详情按需展开。

### Don't:

- **Don't** 以示例收益、持仓、研究报告或交易填满真实空账户。
- **Don't** 用涨跌颜色替代买卖、拒绝、风险或服务状态的文字。
- **Don't** 把未知价格、未知费用、缺失行情或样本不足的指标显示为零。
- **Don't** 把关闭的新模拟入口或历史精度提示解读成所有账户同一种能力。
- **Don't** 把推送已受理显示为设备已收到或用户已读。
