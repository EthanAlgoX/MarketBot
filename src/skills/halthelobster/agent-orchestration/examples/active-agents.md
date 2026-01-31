# Active Agents — Tracking Template

> Copy this file to `notes/areas/active-agents.md` in your workspace.

Track spawned sub-agents until completion. **No orphans.**

---

## Currently Running

| Label | Task Summary | Spawned | Expected | Status |
|-------|--------------|---------|----------|--------|
| `example-research` | Research competitor pricing | Jan 30 9:00 AM | 15m | 🏃 Running |
| `example-builder` | Build dashboard v2 | Jan 30 9:15 AM | 30m | 🏃 Running |

**Status icons:**
- 🏃 Running
- ⏸️ Paused/Waiting
- 🔄 Restarted
- ⚠️ Stalled (running longer than expected)

---

## Completed Today

| Label | Task | Runtime | Result | Learnings |
|-------|------|---------|--------|-----------|
| `research-api-options` | Compare API providers | 8m | ✅ Done | Good prompt structure worked |
| `builder-cli-tool` | Build CLI helper | 12m | ✅ Done | Ralph mode helped with edge cases |
| `review-pr-47` | Review auth PR | 4m | ✅ Approved | Need better security criteria |

**Result icons:**
- ✅ Success — user stories satisfied
- ⚠️ Partial — some stories incomplete
- ❌ Failed — didn't achieve goal
- 🔄 Respawned — needed another attempt

---

## Completed This Week

| Date | Label | Task | Result | Key Learning |
|------|-------|------|--------|--------------|
| Jan 29 | `research-db-options` | Vector DB comparison | ✅ | search_limit prevents rabbit holes |
| Jan 28 | `builder-script-v1` | Data migration script | ⚠️ → ✅ | Ralph mode on 2nd attempt |
| Jan 27 | `review-docs` | API docs review | ✅ | Need "completeness" criterion |

---

## Process

### On Spawn
1. Add row to "Currently Running" immediately
2. Fill in: label, task summary, spawn time, expected duration
3. Set initial status to 🏃 Running

### During Heartbeats
```bash
# Check active sessions
sessions_list --activeMinutes 120 --limit 10
```

For each agent in "Currently Running":
- **Still active?** → Update status if needed
- **Completed?** → Review output, move to Completed, log learnings
- **Timed out?** → Investigate, consider respawn
- **Failed?** → Debug prompt, respawn with fixes

### On Completion
1. Move from "Currently Running" to "Completed Today"
2. Record actual runtime
3. Assess result (✅/⚠️/❌)
4. **Write one learning** — what worked or didn't
5. If pattern was valuable → update templates

### Weekly Review
1. Move "Completed Today" rows to "Completed This Week"
2. Review learnings — any patterns?
3. Update `LEARNINGS.md` with insights
4. Archive older entries (keep last 2 weeks)

---

## Troubleshooting

### Agent Not Reporting Back
1. Check `sessions_list` — is it still running?
2. If completed silently: Check output files/logs
3. If hung: Kill and respawn with clearer completion instructions

### Agent Took Too Long
1. Was the task scoped appropriately?
2. Was there a search/iteration limit?
3. Add constraints to prevent in future

### Agent Failed
1. Read the full output — what went wrong?
2. Was the prompt clear enough?
3. Were user stories testable?
4. Respawn with improved prompt

### Multiple Agents Doing Same Work
1. Check before spawning — is this already running?
2. Use unique, descriptive labels
3. Kill duplicates, keep better-scoped one

---

## Labels Convention

Use consistent, descriptive labels:

```
{type}-{target}-{version?}
```

**Types:**
- `research-` — Information gathering
- `builder-` — Creating files/code
- `review-` — Quality checks
- `monitor-` — Ongoing observation
- `fix-` — Bug fixes

**Examples:**
- `research-competitor-pricing`
- `builder-dashboard-v2`
- `review-auth-module`
- `monitor-deploy-status`
- `fix-login-bug`

---

## Integration

### With Heartbeat Routine
Add to your `HEARTBEAT.md`:
```markdown
## Agent Check
- [ ] Run `sessions_list --activeMinutes 120`
- [ ] Update active-agents.md status
- [ ] Report significant changes to human
```

### With LEARNINGS.md
When an agent completes, ask:
1. Did the prompt set it up for success?
2. What would I do differently?
3. Should I update a template?

Log insights to `notes/resources/prompt-library/LEARNINGS.md`

### With PARA
- Agent outputs → appropriate PARA folder
- Research results → `notes/resources/`
- Build artifacts → `notes/projects/{project}/`

---

*Part of the Hal Stack 🦞 — Agent Orchestration*
