---
name: gsd:settings
description: Configure GSD workflow toggles and model profile
allowed-tools:
  - Read
  - Write
---

<objective>
Configure workflow agents (on/off) and model profile interactively.
Updates `.planning/config.json`.
</objective>

<process>

## Step 1: Validate Environment

```bash
if [ ! -f .planning/config.json ]; then
  echo "ERROR: No config found. Run /gsd new-project first."
  exit 1
fi
```

## Step 2: Read Current Config

```bash
cat .planning/config.json
```

Parse current values:
- `model_profile` (quality/balanced/budget)
- `workflow.research` (true/false)
- `workflow.plan_check` (true/false)
- `workflow.verifier` (true/false)

## Step 3: Present Settings

Ask user for each setting:

**Model Profile:**
- Quality — Opus everywhere (highest cost)
- Balanced — Opus for planning, Sonnet for execution (recommended)
- Budget — Sonnet/Haiku (lowest cost)

**Workflow Agents:**
- Research — Spawn researcher before planning?
- Plan Check — Verify plans before execution?
- Verifier — Verify phase completion?

## Step 4: Update Config

```json
{
  "model_profile": "balanced",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true
  }
}
```

## Step 5: Confirm

```
---

## ✓ Settings Updated

| Setting | Value |
|---------|-------|
| Model Profile | {profile} |
| Research | {On/Off} |
| Plan Check | {On/Off} |
| Verifier | {On/Off} |

These apply to future plan-phase and execute-phase runs.

---
```

</process>

<success_criteria>
- [ ] Current config read
- [ ] User selected settings
- [ ] Config updated
- [ ] Changes confirmed
</success_criteria>
