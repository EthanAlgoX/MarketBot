---
name: capability-evolver
description: A self-evolution engine for AI agents. Analyzes runtime history to identify improvements and applies protocol-constrained evolution.
metadata: {"marketbot":{"emoji":"🧬","triggers":["evolve","self-improvement","refactor","optimize"],"output":"evolution-report","risk":"medium","freshness":"reference","tools":["market_source_plan"]}}
---

# 🧬 Capability Evolver

**"Evolution is not optional. Adapt or die."**

The **Capability Evolver** is a meta-skill that allows MarketBot agents to inspect their own runtime history, identify failures or inefficiencies, and autonomously write new code or update their own memory to improve performance.

## Features

- **Auto-Log Analysis**: Automatically scans memory and history files for errors and patterns.
- **Self-Repair**: Detects crashes and suggests patches.
- **GEP Protocol**: Standardized evolution with reusable assets.
- **One-Command Evolution**: Just run `/evolve`.

## Usage

### Standard Run (Automated)

Runs the evolution cycle. If no flags are provided, it assumes fully automated mode and executes changes immediately.

```bash
/evolve
```

### Review Mode (Human-in-the-Loop)

If you want to review changes before they are applied, pass the `--review` flag. The agent will pause and ask for confirmation.

```bash
/evolve --review
```

## GEP Protocol (Auditable Evolution)

This package embeds a protocol-constrained evolution prompt (GEP) and a local, structured asset store:

- `assets/gep/genes.json`: reusable Gene definitions
- `assets/gep/capsules.json`: success capsules to avoid repeating reasoning
- `assets/gep/events.jsonl`: append-only evolution events (tree-like via parent id)

## Emoji Policy

Only the DNA emoji is allowed in documentation. All other emoji are disallowed.

## Configuration & Decoupling

This skill is designed to be **environment-agnostic**. It uses standard MarketBot tools by default.

## Safety & Risk Protocol

### 1. Identity & Directives

- **Identity Injection**: "You are a Recursive Self-Improving System."
- **Mutation Directive**:
  - If **Errors Found** -> **Repair Mode** (Fix bugs).
  - If **Stable** -> **Forced Optimization** (Refactor/Innovate).

### 2. Risk Mitigation

- **Infinite Recursion**: Strict single-process logic.
- **Review Mode**: Use `--review` for sensitive environments.
- **Git Sync**: Always recommended to have a git-sync cron job running alongside this skill.

## License

MIT
