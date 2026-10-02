[English](finance_workflows.md) | [简体中文](finance_workflows_zh-CN.md)

# 金融持续研究流程

以下计算样例是演示输入，不是真实市场数据。CLI 原生金融工具与持续监控无需模型账号；
聊天 Agent 使用同名工具时仍需模型。所有步骤应使用同一配置和工作区，未知来源时间保留缺口。

默认回复语言为英文（`agents.defaults.language="en"`）；单次用 `marketbot --language zh ...` 覆盖，保存中文偏好用 `marketbot --config finance-config.json language --set zh`，切回英文用 `--set en`。金融 JSON 字段和原始来源内容保持稳定，不随语言切换改写。

## 创建隔离配置

先安装项目并让 `marketbot` 命令可用（源码运行可先 `uv sync --extra dev`，再使用
`uv run marketbot`）。在你选择的工作目录执行：

```bash
python - <<'PY'
import json
from pathlib import Path
workspace = Path("finance-workspace").resolve()
config = {"agents": {"defaults": {"workspace": str(workspace)}},
          "tools": {"market": {"enabled": True}}}
Path("finance-config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
PY
```

这是独立演示配置，默认渠道关闭，后续命令不外发消息。无需 `onboard` 或模型 API key。
每次都传 `--config finance-config.json`；也可使用顶层
`marketbot --config <配置路径> --workspace <工作区路径> finance ...`。
勿在已有同名配置的目录直接覆盖文件。

## 组合计算与证据

保存 `portfolio.json`：

```json
{
  "baseCurrency": "CNY",
  "holdings": [
    {"symbol":"AAPL","quantity":"10","price":"200","currency":"USD"},
    {"symbol":"0700.HK","quantity":"100","price":"400","currency":"HKD"}
  ],
  "cash":[{"currency":"CNY","amount":"10000"}],
  "fxRates":{"USD":{"rate":"7"},"HKD":{"rate":"0.9"}},
  "scenarios":[{"name":"明确假定价格下跌20%","shockPct":"-20"}]
}
```

```bash
marketbot finance call portfolio_risk --input portfolio.json --config finance-config.json
```

此样例总值 60000 CNY，现金 10000，假设冲击后 50000；不是收益预测。
汇率为「一单位外币折合多少基币」，基币自身自动为 1。缺价格或任一所需 FX 时返回错误，
不会给出看似完整的组合总值。只给持仓权重不足以运行此工具；它不获取行情。
结果包含本地 `evidenceRecordId`，保存完整输入、结果与方法；计算记录不能当作原始行情证据。

保存 `quotes.json` 为 `{"symbols":["600519","0700.HK","SPY"]}`，执行：

```bash
marketbot finance call market_snapshot --input quotes.json --config finance-config.json > snapshot-result.json
```

每条已记录报价含 `evidenceId`。用真实返回 ID 保存 `get-evidence.json`：

```json
{"evidenceId":"ev_<返回的完整64位哈希>"}
```

```bash
marketbot finance call evidence_get --input get-evidence.json --config finance-config.json
```

数值、币种、来源和 `observedAt` 均取账本，不凭记忆填补。`asOf`/`retrievedAt` 是抓取时间，
不能代替报价时间。免费公开源可能延迟、被限流或缺字段，来源成功不代表实时。
`market_macro` 缺 FRED key 时明确 unknown，`macroRisk=0.5` 是兼容默认值，不是观测到的风险。
`market_news` 没有可用新闻时返回缺口，不补模拟新闻。

## 论点与复核条件

保存 `thesis.json`：

```json
{
  "action":"create",
  "symbol":"600519",
  "thesis":"用户明确指定的示例假设：价格不跌破1000 CNY",
  "confidence":0,
  "rules":[{"id":"price_floor","metric":"price","operator":"lt","threshold":"1000","effect":"falsified","maxAgeSeconds":3600}]
}
```

```bash
marketbot finance call thesis_tracker --input thesis.json --config finance-config.json
```

复制返回论点 `id` 和某条真实报价的 `evidenceId`，保存 `review.json`。独立报价记录的字段在
`/price`；若引用完整 snapshot 记录则使用对应 `/quotes/0/price`，必须选择相同标的：

```json
{
  "action":"review",
  "thesisId":"<真实返回的论点ID>",
  "observations":[{"metric":"price","evidenceId":"<真实报价记录ID>","jsonPointer":"/price"}]
}
```

```bash
marketbot finance call thesis_tracker --input review.json --config finance-config.json
```

`review` 按原始字段比较规则；全部条件都有有效事实才能验证。缺失、过期、估算或模拟证据
返回 `verificationStatus=inconclusive`，状态和置信度不变。规则阈值使用对应字段的原始单位。
假日/闭市数据可能超过一小时，应按研究需求显式修改规则时效，不把抓取时间改成报价时间。
`update` 的文本 `evidence` 保存叙事，情绪不会自动证伪；显式用户 `verdict` 是未验证声明。
规则不自动估计置信度，定性前提仍需研究者判断。

## 观察名单与持续提醒

保存 `watch.json`：

```json
{
  "action":"save",
  "name":"我的观察名单",
  "kind":"watchlist",
  "symbols":["600519","0700.HK"],
  "maxAgeSeconds":3600,
  "rules":[{"type":"price_change","thresholdPct":"5","direction":"either"}]
}
```

```bash
marketbot finance call market_watch --input watch.json --config finance-config.json
marketbot finance poll <返回的watchId> --config finance-config.json
marketbot finance schedule <同一个watchId> --every-minutes 15 --config finance-config.json
marketbot finance schedule-list --config finance-config.json
marketbot --config finance-config.json gateway --finance-only
```

`gateway --finance-only` 持续运行原生金融/Intel 任务，无需模型；用 Ctrl-C 停止。
定时任务只有 Gateway 运行时才执行，重启后从相同工作区恢复。该模式不支持聊天 Agent 和
LLM 任务，检测到不支持的任务会明确拒绝，保留任务。`schedule` 只是保存任务，不会启动进程。

首次完整、新鲜、与证据匹配的数据静默建立基线；突破或恢复阈值才生成下一次价格提醒。
缺口会产生一次数据质量提醒，相同缺口不反复提醒；有效基线不推进。
超过 `maxAgeSeconds`，或报价时间、币种、FX 缺失，均不建立新的有效基线。
Tencent 美股源时区无法确认时严格监控会报告缺口；不要给它补当前时间。

读取本地告警：保存 `outbox.json` 为 `{"action":"outbox","watchId":"<真实watchId>"}`：

```bash
marketbot finance call market_watch --input outbox.json --config finance-config.json
```

查看后，保存 `ack.json` 为 `{"action":"ack","alertId":"<真实alertId>"}`，执行：

```bash
marketbot finance call market_watch --input ack.json --config finance-config.json
```

取消定时任务使用返回的 **jobId**（与 watchId 不同）：

```bash
marketbot finance unschedule <jobId> --config finance-config.json
marketbot finance schedule-list --config finance-config.json
```

取消计划保留观察定义、历史和告警。停用观察定义则用
`{"action":"remove","watchId":"<真实watchId>"}` 调用 `market_watch`，保留审计历史。
重复 `schedule` 会报已有 jobId；先 `finance unschedule` 再修改投递设置。
`intel schedule-list/remove` 只管理 Intel 任务，不管理金融计划。

默认只留本地。确需外发时先在同一配置中启用相应渠道并设置凭据，然后显式指定目的地：

```bash
marketbot finance schedule <watchId> --every-minutes 15 --deliver --channel telegram --to <chatId> --config finance-config.json
```

入队不等于远端送达：未 ack 的告警保持持久化，当前 Gateway 去重，重启后可重投相同 alertId。
确认收到后再 ack；实际投递依赖渠道账号、网络和权限。

## 跨币种持仓监控：完整 FX 证据路径

`portfolio_risk` 可计算用户提供的汇率；持续监控另外要求报价和外币汇率都有可匹配的原始
证据、实际观测时间和来源。当前 `finance poll` 自动刷新证券报价，不自动获取 FX。
后续检查复用最近一次完整有效快照中的 FX，过期即报告缺口；需从外部来源取得新 FX 后显式
`market_watch evaluate` 提供新汇率证据，不能凭模型猜值或用抓取时间延长寿命。

以下是 **模板**，尖括号都要换成公开来源实际返回字段后才执行；不要把示例数字、合成数据
或未知时间标成真实。假设组合基币 CNY，需要一单位 HKD 折合多少 CNY。将原始 FX 输入保存
为 `fx-source.json`：

```json
{
  "kind":"fx",
  "source":"<真实公开提供者>",
  "sourceUrl":"<不含凭据的公开来源URL>",
  "observedAt":"<来源实际ISO时间且包含时区>",
  "payload":{
    "currency":"HKD",
    "baseCurrency":"CNY",
    "rate":"<原始HKD兑CNY汇率>",
    "source":"<与上面相同的提供者>",
    "observedAt":"<与上面相同的实际观测时间>"
  }
}
```

```bash
marketbot finance call evidence_record --input fx-source.json --config finance-config.json > fx-result.json
```

账本匹配验证字段与已保存证据一致，不验证人为导入数据的经济真实性；导入者对来源准确性
负责。缺 `baseCurrency`、基币不符、估算或模拟汇率不能建立监控基线。只有日期/统计期间的
FX 不能随意补出精确观测时刻；此时保留未知并等待更合适来源。

用先前 `snapshot-result.json` 中真实 HK 报价和新 FX 记录生成完整定义（数量、现金、权重
上限为用户明确输入的演示设置，可自行修改）：

```bash
python - <<'PY'
import json
from pathlib import Path
snapshot = json.loads(Path("snapshot-result.json").read_text())
quote = next(row for row in snapshot["quotes"] if row.get("currency") == "HKD")
fx_record = json.loads(Path("fx-result.json").read_text())["evidence"]
fx = fx_record["payload"]
assert fx["currency"] == "HKD" and fx["baseCurrency"] == "CNY"
assert quote.get("observedAt") and fx.get("observedAt"), "缺实际观测时间，应保留数据缺口"
rate = {"rate": fx["rate"], "source": fx["source"], "observedAt": fx["observedAt"],
        "evidenceIds": [fx_record["evidenceId"]]}
position = {"symbol": quote["symbol"], "quantity": "100", "price": quote["price"],
            "currency": "HKD", "source": quote["provider"], "observedAt": quote["observedAt"],
            "evidenceIds": [quote["evidenceId"]]}
args = {"action": "save", "name": "我的跨币种持仓", "kind": "portfolio", "holdings": [position],
        "baseCurrency": "CNY", "cash": [{"currency": "CNY", "amount": "10000"}],
        "fxRates": {"HKD": rate}, "maxAgeSeconds": 3600,
        "rules": [{"type": "max_weight", "symbol": quote["symbol"], "thresholdPct": "80"}]}
Path("portfolio-watch.json").write_text(json.dumps(args, ensure_ascii=False, indent=2))
PY
marketbot finance call market_watch --input portfolio-watch.json --config finance-config.json > portfolio-watch-result.json
```

生成首次完整评估：

```bash
python - <<'PY'
import json
from pathlib import Path
saved = json.loads(Path("portfolio-watch-result.json").read_text())["watch"]
Path("portfolio-evaluate.json").write_text(json.dumps({"action":"evaluate", "watchId":saved["watchId"]}))
PY
marketbot finance call market_watch --input portfolio-evaluate.json --config finance-config.json
```

首次有效评估静默建立基线；过期则报告缺口且不输出有效总值。刷新时可在 `evaluate` 中提供
完整 `observations` 和新 `fxRates`（各自带实际 evidenceIds），或者完整替换 `holdings` 和
`cash`；不能只换部分持仓或不知情沿用旧现金。新快照可产生持仓变化提醒，自动证券报价轮询
不会发现券商实际交易；更新持仓仍需用户或导入流程。

## 开发评测

```bash
uv sync --extra dev
uv run pytest -q
uv run python scripts/evaluate_finance.py --output .tmp/finance-evaluation.json
uv build
```

场景验收使用确定性夹具，验证计算、证据约束和状态变化；不测投资收益、真实模型写作质量
或供应商准确性。真实来源可用性需要另外测试，HTTP 成功也可能没有可用数据。
完整功能边界见 [项目审计](marketbot_feature_logic_audit.md)。
