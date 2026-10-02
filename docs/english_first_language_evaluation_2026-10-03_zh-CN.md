[English](english_first_language_evaluation_2026-10-03.md) | [简体中文](english_first_language_evaluation_2026-10-03_zh-CN.md)

# 英文优先与中文切换评测 — 2026-10-03

MarketBot 默认使用英文，并支持简体中文。主 README、金融工作流与集成指南均提供完整中文版本；`README_en.md` 保留此前的英文入口。

| 验证范围 | 结果 |
| --- | --- |
| 完整 Python 回归 | 1332 项通过，无失败或跳过 |
| 确定性金融验收 | 15/15 通过 |
| README 离线流程 | 13/13 通过 |
| 仓库目录外的全新安装包，含公开来源检索 | 14/14 通过 |
| CLI 与文档清单 | 53 个命令/help 入口、137 条文档命令、14 个语言入口 |
| 原生工具 / MCP / 技能 | 18 个原生工具、12 个只读 MCP 工具、63 个内置技能 |
| Ruff 与空白检查 | 通过 |
| 密钥扫描 | 通过；新增 provider-key 测试字符串已人工确认不是密钥 |
| 打包内容 | 英文元数据、源码包含七份双语入口文档、六个 bridge 资源，无 cookies 或 node_modules |

[全新安装包流程 JSON](evaluation/english_first_walkthrough_2026-10-03.json)记录实际 CLI、HTTP、MCP 和公开来源验证；[金融验收 JSON](evaluation/english_first_finance_2026-10-03.json)记录 15 项确定性金融检查。

## 已验证的语言行为

`agents.defaults.language` 默认为 `en`，`zh` 表示简体中文。普通命令的全局 `--language` 只覆盖本次调用，不修改保存的配置。`language --set` 只保存指定语言，保留工作区与模型配置。`onboard` 创建或刷新配置时会保存所选语言。

两个独立 Agent 会话向本地协议服务发出四次真实 HTTP 请求，系统语言策略分别为 `[en, en, zh, zh]`。每个会话都执行真实组合工具，得到 `0.02 USD`、保存证据和会话。本地模型 fixture 验证协议与语言传递，不评判真实模型的回答质量。

用户明确指定输出语言时，Agent 回复展示优先采用该语言。测试覆盖中英文指令、否定指令、连续回合、并发任务、嵌套作用域和异常恢复。报告、保存提示、简报因果链和飞书回执采用有效回复语言。`market_brief` 的显式 language 参数优先于该工具的默认语言。

中英文流程保留金融 JSON 字段、组合计算、来源原文、链接、观测时间和用户自定义工作区指令。语言流程保留两条 RSS 原文与原始行情提示。该场景故意禁用 mock 行情来源，实际返回零条行情，未把示例价格当成来源观测。

## 本次修复

- 日报后处理尊重用户明确的语言要求，不再把标题改回配置中的默认语言。
- 简报、报告提醒、情报摘要和定时任务接收所选语言。
- 保存的市场报告保留新闻来源链接。
- 未知宏观风险标明中性兼容默认值，不视为真实观测；缺失指标显示“不可用”，不补零。
- 源码包包含完整中英文 README、金融工作流和集成指南；包元数据使用英文 README。

## 公开数据与未实测范围

实际检索到 `600519`、`00700` 和 `SPY` 的公开行情。A 股观测日期为 9 月 30 日，港股为 10 月 2 日；SPY 没有确认的观测时间。新闻返回零条可用内容，宏观数据出现缺少 FRED Key 的提示。这些结果验证检索与数据缺口呈现，不独立证明价格准确或行情实时。

真实模型质量、已认证渠道投递、依赖账号的浏览器/Lark/Twitter/小红书流程、Docker 执行和 GPU/Slime 训练未实测。现有回归与协议测试覆盖其配置约定。完整 `--help` 技术参考、协议名称、金融工具提示和第三方错误保留原文。

## 复现

```bash
python -m pytest tests
python scripts/evaluate_finance.py --output .local/finance-evaluation.json
python scripts/evaluate_readme.py --output .local/readme-evaluation.json
uv build
uv venv .local/wheel-check
uv pip install --python .local/wheel-check/bin/python dist/*.whl
python scripts/evaluate_readme.py --python "$PWD/.local/wheel-check/bin/python" --network --output .local/wheel-evaluation.json
```

评测器在临时目录内执行 CLI。验证安装包时需要使用全新环境中的 Python，避免误用可编辑安装。
