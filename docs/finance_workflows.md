# 金融持续研究流程

所有 JSON 样例都是演示输入，不是真实市场数据。以下 CLI 流程无需模型账号，
聊天 Agent 可使用同名原生工具。操作同一工作区；真实来源时间未知时保留缺口。

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
结果包含本地 evidenceRecordId，保存完整计算输入、结果与方法。

保存 `quotes.json` 为 `{"symbols":["600519","0700.HK","SPY"]}`，调用：

```bash
marketbot finance call market_snapshot --input quotes.json --config finance-config.json
```

每条已记录报价含 `evidenceId`。用真实返回 ID 保存 `get-evidence.json`，内容为
`{"evidenceId":"ev_<返回的完整ID>"}`；调用 `finance call evidence_get`。
时间/币种/数值均取账本，不凭记忆填补；来源成功不代表实时或有足够新鲜的数据。

## 论点与复核条件

保存 `thesis.json`：

```json
{
  "action":"create",
  "symbol":"600519",
  "thesis":"用户明确指定的示例假设：价格不跌破1000 CNY",
  "rules":[{"id":"price_floor","metric":"price","operator":"lt","threshold":"1000","effect":"falsified","maxAgeSeconds":3600}]
}
```

```bash
marketbot finance call thesis_tracker --input thesis.json --config finance-config.json
```

使用返回 thesis ID 和某条真实报价 evidence ID 保存复核 JSON：

```json
{
  "action":"review",
  "thesisId":"<真实返回ID>",
  "observations":[{"metric":"price","evidenceId":"<真实报价记录ID>","jsonPointer":"/price"}]
}
```

`review` 使用原始字段比较规则，缺失/过期/估算返回 verificationStatus=inconclusive，状态不变。
`update(evidence=...)` 保存叙事，情绪不会自动证伪。显式用户 verdict 是未验证声明。
规则不自动给置信度；定性前提仍需研究者判断。

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
marketbot finance poll <watchId> --config finance-config.json
marketbot finance schedule <watchId> --every-minutes 15 --config finance-config.json
marketbot gateway --config finance-config.json
```

首次有效数据静默建立基线；突破或恢复阈值才生成下一次提醒。超过 maxAgeSeconds、
报价时间/FX/币种缺失均不会推进基线。假日/闭市报价可能过期：应按研究需求显式选择
时效窗口，不自动延长标准。Tencent 美股源时区无法确认时严格监测会报告缺口。

`kind="portfolio"` 可保存完整 holdings、cash、baseCurrency、fxRates，使用
`max_weight` 规则检查某标的占含现金总值的上限。外国 FX 也需要新鲜来源和 evidenceIds。
完整替换持仓时同时提供现金，避免不知情沿用旧余额。

默认告警只留本地，保存 `{"action":"outbox","watchId":"<真实ID>"}` 后调用 `market_watch` 查看。
外发必须明确配置：

```bash
marketbot finance schedule <watchId> --every-minutes 15 --deliver --channel telegram --to <chatId> --config finance-config.json
```

渠道需启用且有凭据。重复 schedule 会报已有 jobId；用现有 `intel schedule-list` / `intel schedule-remove`
或 `cron` 工具管理该工作区的定时任务。先移除原任务再改投递设置。

入队不等于远端送达：未 ack 的告警保持持久化，当前 Gateway 去重，重启后重投稳定 alertId。
实际收到后，用 `{"action":"ack","alertId":"<真实ID>"}` 调用 `market_watch` 确认。
停用使用 `{"action":"remove","watchId":"<真实ID>"}`，保留审计历史并停止取行情。

## 开发评测

```bash
uv sync --extra dev
uv run pytest -q
uv run python scripts/evaluate_finance.py --output .tmp/finance-evaluation.json
uv build
```

场景验收使用确定性夹具，验证计算和状态变化；不测投资收益、真实模型写作质量或供应商准确性。
完整功能边界见 [项目审计](marketbot_feature_logic_audit.md)。
