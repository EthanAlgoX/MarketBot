---
name: intel-collector
description: Manage intel sources, collect raw items, and schedule recurring collection runs.
metadata: {"marketbot":{"emoji":"🗂️","triggers":["intel collect","collect rss","add rss source","schedule collect","资讯采集","rss 采集","添加rss源","情报源"],"output":"intel-collector-report","risk":"low","freshness":"reference","tools":["exec"],"required_tools":["exec"],"markets":["global"],"asset_classes":["macro"],"task_type":"orchestration","determinism":"tool-backed","priority":69}}
---

# Intel Collector

Use this skill to manage workspace intel sources and run collection jobs.

## Workflow

1. Add or inspect sources with the `marketbot intel source-*` commands.
2. Run `marketbot intel collect` when the user wants an immediate refresh.
3. Use `marketbot intel schedule-collect` when the user wants recurring collection.
4. If the user wants a recurring digest with fresh coverage, prefer the combined `marketbot intel schedule-latest-daily` command.
5. If you need to show the underlying pieces, collection and digest generation are separate jobs: `marketbot intel schedule-collect` upstream and `marketbot intel schedule-daily` downstream.
6. If the user wants a digest at a specific time such as 08:00, use `marketbot intel schedule-latest-daily` or show `07:55` collect and `08:00` digest explicitly.
7. Use `marketbot intel schedule-list` and `marketbot intel schedule-remove <job-id>` to manage only intel-specific schedules.
8. Keep source management and digest generation separate: this skill manages inputs, not final digest formatting.

## Command examples

```bash
marketbot intel source-add --type rss --name "OpenAI Blog" --url https://openai.com/blog/rss.xml
marketbot intel source-list
marketbot intel collect
marketbot intel schedule-collect --every-minutes 30
marketbot intel schedule-latest-daily --collect-cron-expr "55 7 * * *" --digest-cron-expr "0 8 * * *" --tz Asia/Shanghai
marketbot intel schedule-collect --cron-expr "55 7 * * *" --tz Asia/Shanghai
marketbot intel schedule-daily --cron-expr "0 8 * * *" --tz Asia/Shanghai
marketbot intel schedule-list
marketbot intel schedule-remove <job-id>
```
