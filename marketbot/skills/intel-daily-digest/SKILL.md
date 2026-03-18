---
name: intel-daily-digest
description: Build a daily intelligence digest from collected workspace sources and saved raw items.
metadata: {"marketbot":{"emoji":"🧠","triggers":["intel digest","daily digest","资讯日报","情报摘要","ai digest schedule","daily digest schedule"],"output":"intel-daily-digest","risk":"low","freshness":"reference","tools":["exec"],"required_tools":["exec"],"markets":["global"],"asset_classes":["macro"],"task_type":"orchestration","determinism":"tool-backed","priority":70}}
---

# Intel Daily Digest

Use this skill to generate a daily digest from previously collected raw items
in the workspace intel store.

## Workflow

1. If the user wants the latest coverage, run a collection pass first.
2. Build the daily digest from the last 24 hours of `intel_raw_items`.
3. Prefer concise Markdown output.
4. Do not pad weak items just to fill the list.
5. If the user asks for recurring delivery of the latest digest, prefer `marketbot intel schedule-latest-daily` because it creates both the upstream collect job and the downstream digest job together.
6. If you need to show the underlying pieces, use:
   `marketbot intel schedule-collect --cron-expr "55 7 * * *" --tz Asia/Shanghai`
   `marketbot intel schedule-daily --cron-expr "0 8 * * *" --tz Asia/Shanghai`
7. Do not describe `marketbot intel schedule-daily` as a collection job; it only builds the digest from already collected items.
8. When the user asks how to inspect or manage existing digest schedules, prefer `marketbot intel schedule-list` and `marketbot intel schedule-remove <job-id>`.

## Command examples

```bash
marketbot intel collect --scope workspace
marketbot intel digest-daily --scope workspace
marketbot intel schedule-latest-daily --collect-cron-expr "55 7 * * *" --digest-cron-expr "0 8 * * *" --tz Asia/Shanghai
marketbot intel schedule-collect --cron-expr "55 7 * * *" --tz Asia/Shanghai
marketbot intel schedule-collect --every-minutes 30
marketbot intel schedule-daily --cron-expr "0 8 * * *" --tz Asia/Shanghai
marketbot intel schedule-list
marketbot intel schedule-remove <job-id>
```
