---
name: gsd:execute-plan-auth
description: Authentication gate handling for execute-plan workflow
argument-hint: ""
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

<objective>
Authentication gate handling for execute-plan.md. Load this file dynamically when an authentication error is encountered during task execution.

**Trigger:** Load this file when CLI/API returns authentication errors:
- "Error: Not authenticated", "Not logged in", "Unauthorized", "401", "403"
- "Authentication required", "Invalid API key", "Missing credentials"
- "Please run {tool} login" or "Set {ENV_VAR} environment variable"
</objective>

<execution_context>
This is an extension to execute-plan.md, loaded dynamically when auth errors occur.
</execution_context>

<context>
Current task context from execute-plan.md
</context>

<process>

## Authentication Gate Protocol

**When you encounter authentication errors during `type="auto"` task execution:**

This is NOT a failure. Authentication gates are expected and normal. Handle them dynamically:

**Authentication error indicators:**

- CLI returns: "Error: Not authenticated", "Not logged in", "Unauthorized", "401", "403"
- API returns: "Authentication required", "Invalid API key", "Missing credentials"
- Command fails with: "Please run {tool} login" or "Set {ENV_VAR} environment variable"

## Phase 1: Recognize Auth Gate

Recognize it's an auth gate - Not a bug, just needs credentials.

## Phase 2: Stop Current Task

STOP current task execution - Don't retry repeatedly.

## Phase 3: Create Dynamic Checkpoint

Present it to user immediately with exact authentication steps:

```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Action Required                          ║
╚═══════════════════════════════════════════════════════╝

Progress: {X}/{Y} tasks complete
Task: Authenticate {service} CLI

Attempted: {command}
Error: {error message}

What you need to do:
  1. Run: {auth command}
  2. {additional steps}

I'll verify: {verification command}

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "done" when authenticated
────────────────────────────────────────────────────────
```

## Phase 4: Wait for User

Wait for user to authenticate - Let them complete auth flow.

## Phase 5: Verify Authentication

```bash
# Run verification command
{verification_command}
```

Test that credentials are valid.

## Phase 6: Retry Original Task

Resume automation where you left off.

## Phase 7: Continue Normally

Don't treat this as an error in Summary.

## Common Services Auth Patterns

| Service | Auth Error Pattern | Auth Command | Verification |
|---------|-------------------|--------------|--------------|
| Vercel | "Not authenticated" | `vercel login` | `vercel whoami` |
| Netlify | "Not logged in" | `netlify login` | `netlify status` |
| AWS | "Unable to locate credentials" | `aws configure` | `aws sts get-caller-identity` |
| GCP | "Could not load the default credentials" | `gcloud auth login` | `gcloud auth list` |
| Supabase | "Not logged in" | `supabase login` | `supabase projects list` |
| Stripe | "No API key provided" | Set STRIPE_SECRET_KEY | `stripe config --list` |
| Railway | "Not authenticated" | `railway login` | `railway whoami` |
| Fly.io | "Not logged in" | `fly auth login` | `fly auth whoami` |
| Convex | "Not authenticated" | `npx convex login` | `npx convex dashboard` |
| Cloudflare | "Authentication error" | `wrangler login` | `wrangler whoami` |

## Summary Documentation

Document authentication gates as normal flow, not deviations:

```markdown
## Authentication Gates

During execution, I encountered authentication requirements:

1. Task 3: Vercel CLI required authentication
   - Paused for `vercel login`
   - Resumed after authentication
   - Deployed successfully

These are normal gates, not errors.
```

</process>

<key_principles>
- Authentication gates are NOT failures or bugs
- They're expected interaction points during first-time setup
- Handle them gracefully and continue automation after unblocked
- Don't mark tasks as "failed" or "incomplete" due to auth gates
- Document them as normal flow, separate from deviations
</key_principles>

<success_criteria>
- [ ] Auth error recognized as gate, not failure
- [ ] Clear instructions provided to user
- [ ] Verification command run after user completes auth
- [ ] Original task retried and completed
- [ ] Documented in Summary as normal flow
</success_criteria>
