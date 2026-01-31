# 🧠 Skill Router (Skill Orchestrator)
**An explainable, deterministic meta-skill that decides _which_ skill to use, _how_ to use it, and _whether_ it is safe — before anything runs.**
Skill Router operates as a **decision and governance layer above all other skills**.
It inventories available skills, scores them transparently, applies safety gates, and orchestrates the optimal execution strategy — always with user visibility and control.
> **No black boxes. No silent execution. No hallucinated APIs.**
---
## 🚀 How to Run (Trigger Phrases)
Invoke the Skill Router using natural language:
- decide which skill to use
- use the best skill for this
- route this task automatically
- orchestrate my skills
- figure out the optimal approach
- handle this in the most efficient way
- skill router: <task>
- orchestrator: <task>
---
## ✅ Checklist — Step by Step
### Step 0 — Task Intake & Normalization
- Capture the raw user request verbatim.
- Normalize into:
  - **Goal** — what success looks like
  - **Constraints** — hard requirements and prohibitions
  - **Urgency** — LOW / MEDIUM / HIGH
  - **Environment** — OS, local vs remote, runtime limits
  - **Risk profile** — LOW / MEDIUM / HIGH / CRITICAL
- Identify required actions:
  - read, write, execute, network, credentials
- Detect missing information and mark explicitly.
- Never guess missing data.
---
### Step 1 — Skill Inventory
- Attempt to list installed skills using official platform APIs.
- If unavailable, fall back to:
  - Directory scanning
  - Skill manifests (skill.json, manifest.json)
- Normalize each skill into:
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "supported_actions": [],
  "required_permissions": [],
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
  "cost_latency": {
    "estimated_ms": 0,
    "cost_hint": "FREE | LOW | MED | HIGH"
  },
  "failure_modes": []
}
If inventory is partial or empty, continue in best-effort / plan-only mode.
Step 2 — Task Classification
Classify into one or more:
Planning / Writing
Coding / DevOps
Filesystem Operations
Security / Auditing
Data / Analysis
Web / Research
Automation
Ideation / Brainstorming
Identify disallowed actions (e.g. “no internet”, “read-only”).
Step 3 — Skill Scoring Model (0–100)
Component Weight
Task Relevance 0–40
Environment Compatibility 0–15
Permission Fit 0–10
Latency & Cost Efficiency 0–10
Risk Alignment 0–15
Historical Success (local) 0–10
Formula
Score = R + E + P + C + A + H
Hard Gates
Disallowed actions → score = 0
CRITICAL risk mismatch → score capped at 25 unless overridden
Step 4 — Strategy Selection
Choose exactly one:
Single-skill execution
Multi-skill pipeline
Clarifying question (max 1–2)
All decisions are justified.
Step 5 — Safety Gates
Risk ≥ HIGH → confirmation required
Filesystem / Network / Credentials → preview required
External APIs → data disclosure + consent
Missing permissions → degrade or abort safely
Step 6 — Execution & Fallback
Execute selected skill(s).
On failure:
Analyze error
Retry with next-best candidate (max 2 attempts)
Never escalate risk without new confirmation.
Step 7 — Reporting & Learning
Generate a structured report.
Optionally store a local-only history record.
Secrets are always redacted.
📊 Output Format (STRICT)
🧠 Skill Router Report
1. Task Analysis <ICON> <STATUS> — <summary>
2. Skill Candidates <ICON> <STATUS> — <top skills + scores>
3. Selection Strategy <ICON> <STATUS> — <chosen approach>
4. Safety Check <ICON> <STATUS> — <confirmation required?>
5. Execution Result <ICON> <STATUS> — <outcome>
6. Fallback Handling <ICON> <STATUS> — <none / attempted>
7. Learning Log <ICON> <STATUS> — <stored / skipped>
Scoreboard:
Primary: XX/100
Alternative: YY/100
Icons:
✅ PASS
⚠️ WARN
❌ FAIL
🛑 CONFIRM
⏭️ SKIP
🔁 Auto-Action Flow
Always display the report first.
If confirmation is required, ask:
Proceed? (yes / no / pick)
yes → execute
no → abort
pick → user selects skills or steps
🧩 Action Recipes
Listing Skills (No API)
Scan directories
Parse manifests
Never infer capabilities
Force a Specific Skill
override router: <skill-id>
Full safety gates still apply
Disable a Skill
Add to local denylist
Excluded from scoring
Dry-Run Mode
Perform Steps 0–5 only
No execution
Verbose Diagnostics
Full scoring breakdown
Inventory source
Redaction log
Reset History
Clears local history only
🧠 Extension Module — Brainstorming Mode (Optional)
Multi-Agent Brainstorming Orchestrator:
Business / Strategy Agent
Market / Execution Agent
Rounds:
Idea generation
Critique & risk
Synthesis
Requires explicit consent before external API usage.
🔒 Safety & Guarantees
No destructive actions without confirmation
No silent data exfiltration
No automatic skill installation
No permission bypass
No hallucinated APIs
🚫 What This Skill Does NOT Do
Does not replace human judgment
Does not train ML models
Does not auto-install dependencies
Does not bypass permissions
📚 Reference & Rationale
Skill Router introduces a deterministic, auditable decision layer for agent skills.
It improves:
Safety
Reliability
User trust
Execution success rates
This is governance for agent skills — done right.
---
# ✅ 2️⃣ RESULTADO
✔️ Cria o arquivo **SKILL.md**
✔️ Encoding **UTF-8**
✔️ 100% compatível com **ClawHub / GitHub / GitLab**
✔️ Visual premium (headings, tabelas, blocos, ícones)
---
## 🔥 Próximo passo (se quiser)
Posso:
- Ajustar para **rating máximo no review ClawHub**
- Gerar `README.md` (marketing)
- Criar `CONTRIBUTING.md`
- Criar checklist de aprovação
- Revisar linguagem para **nível enterprise**
Só mandar 🚀
