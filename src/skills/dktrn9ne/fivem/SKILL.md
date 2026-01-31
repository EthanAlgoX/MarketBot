---
name: fivem
description: Fix, create, or validate FiveM server resources for QBCore/ESX (config.lua, fxmanifest.lua, items, housing/furniture, scripts, MLOs). Use when asked to debug resource errors, convert ESX↔QB, update fxmanifest versions, add items, or source scripts from GitHub. Also use for SSH key generation for SFTP access.
---

# FiveM (QBCore/ESX)

## Overview
Handle end‑to‑end FiveM resource work: validate/fix configs, update fxmanifest, convert ESX↔QBCore, add items, set up housing/furniture, debug errors, and scaffold simple scripts/MLO notes. Use references for checklists and patterns.

## Workflow Decision Tree
1) **Locate files**: ask for exact path or upload if not in workspace.
2) **Classify task**:
   - fxmanifest update → use `references/fxmanifest_checklist.md`
   - config.lua fix/validation → use `references/config_patterns.md`
   - ESX↔QB conversion → use `references/qb_esx_conversion.md`
   - items add/update → use `references/items.md`
   - housing/furniture → use `references/housing_furniture.md`
   - debug errors → use `references/debugging.md`
   - GitHub script search → use `references/github_search.md`
   - SSH key generation → use `references/ssh_keys.md`
3) **Apply fixes**: edit precisely, preserve structure, keep comments.
4) **Summarize changes** + provide next steps/testing.

## Core Tasks

### 1) Fix/validate config.lua
- Open file, scan for syntax errors (missing commas/brackets, mismatched quotes, duplicate keys).
- Ensure tables are properly closed and item lists are consistent.
- If unclear, ask for error logs or expected behavior.

### 2) Update fxmanifest.lua
- Normalize to recommended fxmanifest version, ensure `fx_version`, `game`, dependencies, and shared/client/server scripts are correct.
- Make sure exports/imports match resource usage.

### 3) Convert ESX ↔ QBCore
- Map framework hooks, player object access, items, jobs, money, inventory, notifications.
- Keep API differences explicit and document changes.

### 4) Add items
- Insert items into the correct shared items file for the target framework (QB/ESX). Keep weight, stack, image references consistent.

### 5) Housing/Furniture setup
- Validate furniture categories, prices, prop names, and placements; ensure config entries match resource expectations.

### 6) Debug errors
- Ask for console error snippet. Trace to file/line and fix; if a dependency is missing, flag it.

### 7) GitHub script search
- Search by resource name + framework + “fivem” + “qbcore/esx”. Provide top 3 candidates with notes.

### 8) SSH key generation (SFTP)
- Generate ed25519 keypair, provide public key for server, and safe storage guidance.

## References
- `references/fxmanifest_checklist.md`
- `references/config_patterns.md`
- `references/qb_esx_conversion.md`
- `references/items.md`
- `references/housing_furniture.md`
- `references/debugging.md`
- `references/github_search.md`
- `references/ssh_keys.md`
- `references/ox_lib.md`
- `references/menanak47.md`
- `references/qb_target.md`
- `references/qb_core.md`
