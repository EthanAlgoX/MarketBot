[English](finance_workflows.md) | [简体中文](finance_workflows_zh-CN.md)

# Financial research workflows

The calculation examples below are illustrative inputs, not real market data. Native financial CLI tools and continuous monitoring need no model account; the chat agent still requires a model. Use the same configuration and workspace throughout, retaining gaps when source times are unknown.

English is the default (`agents.defaults.language="en"`). Use `marketbot --language zh ...` for one invocation, or `marketbot --config finance-config.json language --set zh` to save Simplified Chinese. Switch back with `--set en`. Agent replies, market report sections and intelligence daily digest sections support the preference; financial JSON fields and original source content remain stable.

## Create an isolated configuration

Install the project and make `marketbot` available first. From source, run `uv sync --extra dev` and use `uv run marketbot`, or follow the [README installation](../README.md). In a directory of your choice, run:

```bash
python - <<'PY'
import json
from pathlib import Path
workspace = Path("finance-workspace").resolve()
config = {"agents": {"defaults": {"workspace": str(workspace), "language": "en"}},
          "tools": {"market": {"enabled": True}}}
Path("finance-config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
PY
```

This independent example configuration keeps channels disabled; subsequent commands do not send messages. No `onboard` or model API key is required. Pass `--config finance-config.json` each time, or use global `marketbot --config CONFIG_PATH --workspace WORKSPACE_PATH finance ...`. Choose a directory without an existing configuration of the same name so this script does not overwrite it.

## Portfolio calculations and evidence

Save `portfolio.json`:

```json
{
  "baseCurrency": "CNY",
  "holdings": [
    {"symbol":"AAPL","quantity":"10","price":"200","currency":"USD"},
    {"symbol":"0700.HK","quantity":"100","price":"400","currency":"HKD"}
  ],
  "cash":[{"currency":"CNY","amount":"10000"}],
  "fxRates":{"USD":{"rate":"7"},"HKD":{"rate":"0.9"}},
  "scenarios":[{"name":"Explicit assumed 20% equity decline","shockPct":"-20"}]
}
```

```bash
marketbot finance call portfolio_risk --input portfolio.json --config finance-config.json
```

This example totals 60000 CNY, including 10000 cash; the assumed shock reduces total value to 50000. It is not a return forecast. FX means base-currency units per one foreign-currency unit; the base currency itself is automatically 1. Missing prices or any required FX rate return an error rather than an apparently complete portfolio value. Weights alone are insufficient; this tool does not fetch prices.

The result includes a local `evidenceRecordId` retaining the complete inputs, output and method. A calculation record cannot serve as original quote evidence.

Save `quotes.json` as `{"symbols":["600519","0700.HK","SPY"]}` and run:

```bash
marketbot finance call market_snapshot --input quotes.json --config finance-config.json > snapshot-result.json
```

Each recorded quote includes `evidenceId`. Use an actual returned ID in `get-evidence.json`:

```json
{"evidenceId":"ev_<complete returned 64-character hash>"}
```

```bash
marketbot finance call evidence_get --input get-evidence.json --config finance-config.json
```

Read numbers, currency, source and `observedAt` from the ledger. `asOf`/`retrievedAt` are retrieval times and cannot replace quote time. Free public sources may be delayed, rate-limited or incomplete; provider success does not establish real-time data. Without a FRED key, `market_macro` reports unknown; `macroRisk=0.5` is a compatibility default, not observed risk. `market_news` retains a gap when news is unavailable and does not fabricate fallback items.

## Investment theses and review conditions

Save `thesis.json`:

```json
{
  "action":"create",
  "symbol":"600519",
  "thesis":"Explicit user hypothesis: the price does not fall below 1000 CNY",
  "confidence":0,
  "rules":[{"id":"price_floor","metric":"price","operator":"lt","threshold":"1000","effect":"falsified","maxAgeSeconds":3600}]
}
```

```bash
marketbot finance call thesis_tracker --input thesis.json --config finance-config.json
```

Copy the returned thesis `id` and an actual quote's `evidenceId` into `review.json`. An independent quote record uses `/price`; a complete snapshot record uses the corresponding `/quotes/0/price`. Select the same symbol:

```json
{
  "action":"review",
  "thesisId":"<actual returned thesis ID>",
  "observations":[{"metric":"price","evidenceId":"<actual quote record ID>","jsonPointer":"/price"}]
}
```

```bash
marketbot finance call thesis_tracker --input review.json --config finance-config.json
```

`review` compares original numerical fields against rules. Every condition needs a valid fact before verification can change the lifecycle. Missing, stale, estimated or simulated evidence returns `verificationStatus=inconclusive`, preserving status and confidence. Thresholds use the original field's units. Closed-market data can exceed one hour; explicitly choose an appropriate rule age rather than replacing quote time with retrieval time.

`update` stores narrative `evidence`; sentiment cannot automatically falsify a thesis. An explicit user `verdict` is an unverified declaration. Rules do not estimate confidence; qualitative premises still require researcher judgement.

## Watchlists and ongoing alerts

Save `watch.json`:

```json
{
  "action":"save",
  "name":"My research watchlist",
  "kind":"watchlist",
  "symbols":["600519","0700.HK"],
  "maxAgeSeconds":3600,
  "rules":[{"type":"price_change","thresholdPct":"5","direction":"either"}]
}
```

```bash
marketbot finance call market_watch --input watch.json --config finance-config.json
marketbot finance poll WATCH_ID --config finance-config.json
marketbot finance schedule WATCH_ID --every-minutes 15 --config finance-config.json
marketbot finance schedule-list --config finance-config.json
marketbot --config finance-config.json gateway --finance-only
```

Replace `WATCH_ID` with the returned `watch.watchId`. `gateway --finance-only` keeps native finance/intelligence jobs running without a model; Ctrl+C stops it. Jobs execute only while Gateway runs and resume from the same workspace after restart. This mode does not support model chat or model tasks; unsupported jobs are explicitly rejected and retained. `schedule` saves a job and does not start a process.

The first complete, fresh observation matching its evidence silently establishes a baseline. Price alerts fire on threshold crossings or recovery. A data gap produces one data-quality alert; the same gap does not repeat, and the valid baseline does not advance. Expired observations or missing quote times, currencies or FX cannot establish a new valid baseline. Tencent US quotes with an unknown source timezone remain a gap for strict monitoring; do not assign them the current time.

Read local alerts by saving `outbox.json` as `{"action":"outbox","watchId":"<actual watch ID>"}`:

```bash
marketbot finance call market_watch --input outbox.json --config finance-config.json
```

After reviewing an alert, save `ack.json` as `{"action":"ack","alertId":"<actual alert ID>"}` and run:

```bash
marketbot finance call market_watch --input ack.json --config finance-config.json
```

Cancel a scheduled job using its returned **jobId**, distinct from watchId:

```bash
marketbot finance unschedule JOB_ID --config finance-config.json
marketbot finance schedule-list --config finance-config.json
```

Cancellation retains the watch definition, history and alerts. Disable a watch with `{"action":"remove","watchId":"<actual watch ID>"}` through `market_watch`, retaining audit history. A duplicate `schedule` reports its existing jobId; use `finance unschedule` before changing delivery settings. `intel schedule-list/remove` manages intelligence jobs only.

Alerts stay local by default. For requested external delivery, enable a channel and configure its credentials in the same configuration, then explicitly choose a recipient:

```bash
marketbot finance schedule WATCH_ID --every-minutes 15 --deliver --channel telegram --to CHAT_ID --config finance-config.json
```

Queued does not mean delivered. Unacknowledged alerts remain durable; the current Gateway deduplicates them, while restart may resend the same alertId. Acknowledge after confirming receipt. Actual delivery requires a valid channel account, network and permissions.

## Cross-currency portfolio monitoring: complete FX evidence path

`portfolio_risk` calculates supplied rates. Ongoing monitoring additionally requires quotes and foreign FX to match original evidence with actual observation times and sources. `finance poll` currently refreshes security prices, not FX. Subsequent checks reuse FX from the last complete valid snapshot; expired FX becomes a gap. Retrieve a new rate externally and supply it explicitly through `market_watch evaluate`. Do not invent a rate or extend its life with retrieval time.

The following is a **template**. Replace every angle-bracket field with the actual public source value before executing it. Never label illustrative numbers, synthetic data or unknown times as actual observations. A CNY-based portfolio needs CNY per one HKD. Save the original FX input as `fx-source.json`:

```json
{
  "kind":"fx",
  "source":"<actual public provider>",
  "sourceUrl":"<public source URL without credentials>",
  "observedAt":"<actual source ISO timestamp with timezone>",
  "payload":{
    "currency":"HKD",
    "baseCurrency":"CNY",
    "rate":"<original HKD-to-CNY rate>",
    "source":"<same provider as above>",
    "observedAt":"<same actual observation time as above>"
  }
}
```

```bash
marketbot finance call evidence_record --input fx-source.json --config finance-config.json > fx-result.json
```

Ledger matching verifies consistency with the retained fields, not the economic truth of manually imported data. The importer is responsible for source accuracy. Missing or mismatched `baseCurrency`, estimated rates and simulated rates cannot establish a monitoring baseline. A date or statistical period does not justify inventing a precise observation instant; retain the unknown time and obtain a suitable source.

Use the actual HK quote in `snapshot-result.json` and the new FX record to generate a complete definition. Quantities, cash and the weight limit below are explicit illustrative user inputs; change them to your own values:

```bash
python - <<'PY'
import json
from pathlib import Path
snapshot = json.loads(Path("snapshot-result.json").read_text())
quote = next(row for row in snapshot["quotes"] if row.get("currency") == "HKD")
fx_record = json.loads(Path("fx-result.json").read_text())["evidence"]
fx = fx_record["payload"]
assert fx["currency"] == "HKD" and fx["baseCurrency"] == "CNY"
assert quote.get("observedAt") and fx.get("observedAt"), "Actual observation time missing; retain the data gap"
rate = {"rate": fx["rate"], "source": fx["source"], "observedAt": fx["observedAt"],
        "evidenceIds": [fx_record["evidenceId"]]}
position = {"symbol": quote["symbol"], "quantity": "100", "price": quote["price"],
            "currency": "HKD", "source": quote["provider"], "observedAt": quote["observedAt"],
            "evidenceIds": [quote["evidenceId"]]}
args = {"action": "save", "name": "My cross-currency portfolio", "kind": "portfolio", "holdings": [position],
        "baseCurrency": "CNY", "cash": [{"currency": "CNY", "amount": "10000"}],
        "fxRates": {"HKD": rate}, "maxAgeSeconds": 3600,
        "rules": [{"type": "max_weight", "symbol": quote["symbol"], "thresholdPct": "80"}]}
Path("portfolio-watch.json").write_text(json.dumps(args, ensure_ascii=False, indent=2))
PY
marketbot finance call market_watch --input portfolio-watch.json --config finance-config.json > portfolio-watch-result.json
```

Generate the initial complete evaluation:

```bash
python - <<'PY'
import json
from pathlib import Path
saved = json.loads(Path("portfolio-watch-result.json").read_text())["watch"]
Path("portfolio-evaluate.json").write_text(json.dumps({"action":"evaluate", "watchId":saved["watchId"]}))
PY
marketbot finance call market_watch --input portfolio-evaluate.json --config finance-config.json
```

The first valid evaluation establishes a quiet baseline. Stale inputs produce a gap without a valid total. To refresh, provide complete `observations` and new `fxRates`, each with actual evidenceIds, or replace complete `holdings` and `cash`. Do not replace only part of the positions or unknowingly retain old cash. A new complete snapshot can generate position-change alerts. Automatic quote polling does not discover broker trades; holdings must still be updated by the user or an import process.

## Development evaluation

```bash
uv sync --extra dev
uv run pytest -q
uv run python scripts/evaluate_finance.py --output .tmp/finance-evaluation.json
uv build
```

Scenario acceptance uses deterministic fixtures to verify calculations, evidence constraints and state transitions. It does not assess returns, real model writing quality or supplier accuracy. Test real source availability separately; successful HTTP may still return no usable data. See the [feature audit](marketbot_feature_logic_audit.md) for full boundaries.
