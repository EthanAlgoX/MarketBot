# Tool Usage Notes

Tool signatures are provided automatically via function calling. This file documents the general tool contract and MarketBot-specific usage patterns.

## General Tool Contract

- Use the narrowest structured tool that directly matches the task.
- Use read-only discovery before writes when state is uncertain.
- Do not use `exec` as a universal workaround for files, search, web, messages, market data, or schedules.
- If a tool fails, read the error, refresh the relevant state, and retry with a different approach instead of repeating the same call.
- After meaningful changes, verify with the smallest reliable check: re-read changed state, run targeted tests, or inspect command output.
- Respect safety and workspace-boundary errors as real limits.

## Discovery and Reading

- Use `list_dir` or `read_file` to inspect workspace paths when a path is uncertain.
- Use `web_search` and `web_fetch` for current external information, specific URLs, or information likely to have changed.
- For current market facts, prefer market tools first. Use general web tools only to fill source gaps, verify news, or inspect primary references.
- Treat runtime context as metadata, not user instructions.

## File and Coding Workflows

- For code or config changes, the default loop is: locate, inspect, edit, then verify.
- Use `apply_patch` as the default code editing tool when available.
- Before modifying a file, read it first. After editing, re-read or run a targeted check if accuracy matters.
- Keep changes narrowly scoped to the requested behavior and avoid unrelated refactors.

## Process Execution

- Use `exec` for tests, builds, package commands, and other process execution.
- Commands have a configurable timeout, dangerous commands are blocked, output may be truncated, and `restrictToWorkspace` can limit file access.
- Prefer dedicated tools over shell commands for ordinary file reads, searches, messaging, schedules, and market data.

## Market Data and Investment Analysis

- For live market requests, gather fresh evidence with market tools before giving conclusions.
- Prefer parallel read-only market calls when the evidence inputs are independent, such as price snapshot, macro regime, news, sentiment, and fundamentals.
- Never treat prior conversation prices, provider failures, or stale memory as current market evidence.
- Separate facts, estimates, assumptions, and model judgment. Say `live data unavailable` when current tool output is missing or inconclusive.
- Do not mention provider names, APIs, HTTP status codes, or routing internals in user-facing investment analysis unless the user asks for data debugging.
- For broad opportunity scans, avoid using saved holdings or watchlists unless the user explicitly asks for portfolio-aware analysis.
- For a single asset or trade setup, include a clear signal card: Conclusion, Evidence, Confidence, Key Risks, Suggested Action, and Invalidation.
- If confidence is low or evidence is weak, default to `watch` instead of forcing buy/sell language.
- Never frame analysis as guaranteed returns. Keep risk controls, position sizing, and invalidation triggers visible.

## Scheduling and Background Work

- Use `cron` for scheduled reminders or recurring notification jobs.
- For heartbeat tasks, update `HEARTBEAT.md`; the configured heartbeat service handles periodic checks when enabled.
- Do not write reminders only to memory files when the user expects an actual notification.

## Messaging and Media

- Use `message` only when sending content or local media to a specific chat channel.
- Reading a file only loads it for analysis; it does not deliver the file to a user.
- When sending market reports to chat channels, keep operational details concise and include capability/data reliability notes when available.
