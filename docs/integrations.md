# 集成、运行与部署

本指南补充 README 的可选功能。先完成 README 的本地计算，并设置 `MARKETBOT_CONFIG_PATH`、`MARKETBOT_WORKSPACE`。下面的账号类功能需要自己的凭据，确定性测试不能证明账号已授权或平台已送达。

## 模型提供商

配置结构为 `agents.defaults.provider/model` 与 `providers.<name>`。支持 custom、Azure OpenAI、OpenRouter、Anthropic、OpenAI、DeepSeek、Gemini、Zhipu、DashScope、Moonshot、MiniMax、AiHubMix、SiliconFlow、VolcEngine、vLLM、Bedrock，以及 OpenAI Codex / GitHub Copilot OAuth。各提供商的模型 ID 和配额以服务方当前文档为准。

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" provider login openai-codex
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" provider login github-copilot
```

OAuth 登录命令使用当前操作系统用户的认证存储，不因金融 workspace 隔离而产生独立账号。状态中的 `authenticationStatus: not_checked` 表示没有检查登录有效性，不能作为成功登录证明。完整 Gateway 启动需要可用模型；finance-only 可以独立运行原生定时任务。

## MCP

`onboard` 配置内置金融 stdio 服务，命令由当前 Python 解释器执行 `-m marketbot.mcp.finance`，传递当前 workspace 和金融源设置。MCP 与原生金融工具共享实现；相同数据不能当作两个独立来源交叉验证。默认只读面不包含假设、watch、证据写入、信号日志或报告写入。

```bash
python -m marketbot.mcp.finance --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" --help
```

这是协议服务，启动后等待客户端 stdio 消息，不提供浏览器网页或 HTTP 端口。自定义服务配置位于 `tools.mcpServers`，支持 stdio、HTTP 和 SSE；选中服务的 `enabled`、`enabledTools`、`toolTimeout`、`env`、`headers` 按配置控制，服务不可达会记录诊断。Alpha Vantage 预设默认关闭，需要设置 `ALPHA_VANTAGE_API_KEY` 并明确启用。使用 `https://mcp.alphavantage.co/mcp` 的官方 [MCP 文档](https://www.alphavantage.co/mcp/) 核对授权方式。

## 技能

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" skills search "portfolio"
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" skills score show --json
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" skills install --help
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" skills score reset --help
```

内置技能随包分发，workspace 下的 `skills/` 用于用户安装内容。安装远程技能时保留来源与许可证并阅读其工具和脚本要求。评分记录使用反馈与任务成功情况；它不验证股票收益，也不证明研究结论正确。

## 渠道

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" channels status --json
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" gateway
```

通过配置 `channels.<name>.enabled`、平台凭据和 `allowFrom` 启用接入。各渠道字段以 `marketbot/config/schema.py` 为准。10 个渠道为 Telegram、Discord、WhatsApp、Feishu、Mochat、DingTalk、Slack、Email、QQ、Matrix。渠道配置为 enabled 不代表凭据有效或远端服务在线；应在各平台完成登录和收发验收。

Matrix 需要可选依赖：

```bash
python -m pip install -e '.[matrix]'
```

WhatsApp 需要 **Node.js 20+** 和 npm。`channels login` 构建并启动本地 bridge、显示扫码流程；Gateway 另开进程连接配置中的 `bridgeUrl`。bridge 真实监听 `127.0.0.1:3001`，与 Gateway 的旧 `--port` 参数无关。

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" channels login
```

`gateway --finance-only` 可以投递显式配置的原生提醒；收到聊天请求时会说明该模式不支持模型聊天，不会启动模型任务。

## 可选 CLI 工具桥接

`status --json` 列出 browser、lark、twitter、xiaohongshu 的启用与可执行文件状态。本轮本地评测不代表这些平台的真实账号操作已通过。

| 工具 | 主要用途 | 配置与依赖 |
| --- | --- | --- |
| Browser | 网页读取和站点适配器 | `tools.browser`，需要 `bb-browser` 与可用浏览器；见[适配器目录](browser_adapter_catalog.md) |
| Lark | 文档、表格、消息与知识库 | `tools.larkCli`，安装与 OAuth 见 [Lark CLI 官方仓库](https://github.com/larksuite/cli)；当前安装入口 `npx @larksuite/cli@latest install` |
| Twitter | 搜索、时间线与授权写操作 | `tools.twitterCli`，需要 `twitter-cli` 和自己的登录；本仓库 wrapper 可用 `MARKETBOT_TWITTER_PYTHON` 指定解释器、`MARKETBOT_TWITTER_CLI_ROOT` 指定模块目录，不依赖某台电脑的路径 |
| 小红书 | 读取、搜索及明确授权的操作 | `tools.xiaohongshuCli`，需要对应 CLI 和本地登录态；Cookies 保留在忽略目录，不进入 Git 或安装包 |

外部 CLI 参数与登录步骤以当前工具的 `--help` 和官方文档为准。开启写操作需配置中允许的能力与用户授权，读取能力正常不能代替写操作验收。飞书 resource ID、聊天 ID 和表格 token 应使用自己的真实资源，不复用示例中的他人 ID。

## 情报调度与模型 Heartbeat

`intel source-add` 支持 RSS 与 website。RSS 使用异步 HTTP 获取，限制请求时长，再解析 RSS/Atom；发布时间不明时保留空值。情报源会去重，但 HTML 页面抓取没有完整内容理解或浏览器渲染。

`intel schedule-collect`、`schedule-daily` 和 `schedule-latest-daily` 保存原生任务，管理用 `intel schedule-list/schedule-remove`。不能同时传递 cron 表达式和间隔；非法 cron 立即失败。Finance 调度单独用 `finance schedule-list/unschedule`。

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" market heartbeat-setup --symbols SPY,QQQ
```

此命令写入 `HEARTBEAT.md`，本身不执行研究。它由完整 Gateway 的模型 Heartbeat 服务读取；`--finance-only` 不运行模型 Heartbeat，也不接受混入的模型 cron 任务。Gateway 的 `--port` 仅保留兼容性，无 HTTP 服务监听。

## RL、OpenClaw 与指标

README 的本地 RL 示例覆盖评估、episode、dataset、适配器与导出包。`rl train` 的 jsonl-supervised 和 slime 适配器目前只导出，即使传 `--no-dry-run` 也不会训练参数。生成的 Slime `generate` shim 使用 MarketSignalTool 的规则信号；真实模型学习、GPU 和外部 OpenClaw-RL 环境需另行实现和验收。

```bash
marketbot --config "$MARKETBOT_CONFIG_PATH" --workspace "$MARKETBOT_WORKSPACE" rl inspect-openclaw-run --bundle-dir .local/readme/openclaw --json
marketbot rl launch-openclaw --help
marketbot rl serve-env --help
marketbot rl list-openclaw-runs --help
marketbot rl compare-openclaw-runs --help
marketbot rl latest-openclaw-report --help
marketbot rl latest-openclaw-metrics --help
marketbot rl serve-metrics --help
```

`serve-env` 是独立的 RL HTTP 环境，支持 episode 分配、重置、动作、推进、奖励与关闭。`serve-metrics` 提供真实 HTTP 路由 `/healthz`、`/metrics`、`/summary.json`、`/alerts` 和 `/alerts/prometheus`。报告与对比读取已存在的运行日志；没有日志时的空结果不能证明训练成功。默认回环绑定适合本机调试，运行前检查 `--help` 的 host、端口与路径。

## Docker

需要 Docker Engine / Compose。源码构建包含 Node.js 20 和 WhatsApp bridge；Gateway 不提供 HTTP API，因此 Compose 不映射 Gateway 端口。

```bash
docker build -t marketbot-local .
docker compose run --rm marketbot-cli onboard
docker compose run --rm marketbot-cli status --json
# 在宿主机 ~/.marketbot/config.json 中配置模型与渠道后启动
docker compose up -d marketbot-gateway
docker compose logs --tail 100 marketbot-gateway
```

Compose 将宿主机 `~/.marketbot` 挂载到容器 `/root/.marketbot`；配置中的 workspace 应使用容器可访问的路径。若要仅运行原生任务，可在本地 Compose override 将 command 设为 `["gateway", "--finance-only"]`。配置文件、会话与 Cookie 是运行数据，不应放入镜像或 Git。

WhatsApp bridge 仍需在同一容器环境另起进程并完成扫码；主 Gateway 服务不会自动启动它。容器内的 `127.0.0.1` 指向容器本身，不能直接连接宿主机或另一个容器的回环 bridge。实际容器构建与账号登录的验收状态见评测报告。
