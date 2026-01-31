<checkpoint_execution>

Reference for executing checkpoints during plan execution. Covers display protocol, authentication gates, and automation commands.

<overview>

Plans execute autonomously. Checkpoints formalize the interaction points where human verification or decisions are needed.

**Core principle:** Claude automates everything with CLI/API. Checkpoints are for verification and decisions, not manual work.

**Golden rules:**
1. **If Claude can run it, Claude runs it** - Never ask user to execute CLI commands, start servers, or run builds
2. **Claude sets up the verification environment** - Start dev servers, seed databases, configure env vars
3. **User only does what requires human judgment** - Visual checks, UX evaluation, "does this feel right?"
4. **Secrets come from user, automation comes from Claude** - Ask for API keys, then Claude uses them via CLI

</overview>

<execution_protocol>

When Claude encounters `type="checkpoint:*"`:

1. **Stop immediately** - do not proceed to next task
2. **Display checkpoint clearly** using the format below
3. **Wait for user response** - do not hallucinate completion
4. **Verify if possible** - check files, run tests, whatever is specified
5. **Resume execution** - continue to next task only after confirmation

**For checkpoint:human-verify:**
```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Verification Required                    ║
╚═══════════════════════════════════════════════════════╝

Progress: 5/8 tasks complete
Task: Responsive dashboard layout

Built: Responsive dashboard at /dashboard

How to verify:
  1. Run: npm run dev
  2. Visit: http://localhost:3000/dashboard
  3. Desktop (>1024px): Sidebar visible, content fills remaining space
  4. Tablet (768px): Sidebar collapses to icons
  5. Mobile (375px): Sidebar hidden, hamburger menu appears

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "approved" or describe issues
────────────────────────────────────────────────────────
```

**For checkpoint:decision:**
```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Decision Required                        ║
╚═══════════════════════════════════════════════════════╝

Progress: 2/6 tasks complete
Task: Select authentication provider

Decision: Which auth provider should we use?

Context: Need user authentication. Three options with different tradeoffs.

Options:
  1. supabase - Built-in with our DB, free tier
     Pros: Row-level security integration, generous free tier
     Cons: Less customizable UI, ecosystem lock-in

  2. clerk - Best DX, paid after 10k users
     Pros: Beautiful pre-built UI, excellent documentation
     Cons: Vendor lock-in, pricing at scale

  3. nextauth - Self-hosted, maximum control
     Pros: Free, no vendor lock-in, widely adopted
     Cons: More setup work, DIY security updates

────────────────────────────────────────────────────────
→ YOUR ACTION: Select supabase, clerk, or nextauth
────────────────────────────────────────────────────────
```

**For checkpoint:human-action:**
```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Action Required                          ║
╚═══════════════════════════════════════════════════════╝

Progress: 3/8 tasks complete
Task: Deploy to Vercel

Attempted: vercel --yes
Error: Not authenticated. Please run 'vercel login'

What you need to do:
  1. Run: vercel login
  2. Complete browser authentication when it opens
  3. Return here when done

I'll verify: vercel whoami returns your account

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "done" when authenticated
────────────────────────────────────────────────────────
```

</execution_protocol>

<authentication_gates>

**Critical:** When Claude tries CLI/API and gets auth error, this is NOT a failure - it's a gate requiring human input to unblock automation.

**Pattern:** Claude tries automation → auth error → creates checkpoint → you authenticate → Claude retries → continues

**Gate protocol:**
1. Recognize it's not a failure - missing auth is expected
2. Stop current task - don't retry repeatedly
3. Create checkpoint:human-action dynamically
4. Provide exact authentication steps
5. Verify authentication works
6. Retry the original task
7. Continue normally

**Example execution flow (Vercel auth gate):**

```
Claude: Running `vercel --yes` to deploy...

Error: Not authenticated. Please run 'vercel login'

╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: Action Required                          ║
╚═══════════════════════════════════════════════════════╝

Progress: 2/8 tasks complete
Task: Deploy to Vercel

Attempted: vercel --yes
Error: Not authenticated

What you need to do:
  1. Run: vercel login
  2. Complete browser authentication

I'll verify: vercel whoami returns your account

────────────────────────────────────────────────────────
→ YOUR ACTION: Type "done" when authenticated
────────────────────────────────────────────────────────

User: done

Claude: Verifying authentication...
Running: vercel whoami
✓ Authenticated as: user@example.com

Retrying deployment...
Running: vercel --yes
✓ Deployed to: https://myapp-abc123.vercel.app

Task 3 complete. Continuing to task 4...
```

**Key distinction:**
- Pre-planned checkpoint: "I need you to do X" (wrong - Claude should automate)
- Auth gate: "I tried to automate X but need credentials" (correct - unblocks automation)

</authentication_gates>

<automation_reference>

**The rule:** If it has CLI/API, Claude does it. Never ask human to perform automatable work.

## Service CLI Reference

| Service | CLI/API | Key Commands | Auth Gate |
|---------|---------|--------------|-----------|
| Vercel | `vercel` | `--yes`, `env add`, `--prod`, `ls` | `vercel login` |
| Railway | `railway` | `init`, `up`, `variables set` | `railway login` |
| Fly | `fly` | `launch`, `deploy`, `secrets set` | `fly auth login` |
| Stripe | `stripe` + API | `listen`, `trigger`, API calls | API key in .env |
| Supabase | `supabase` | `init`, `link`, `db push`, `gen types` | `supabase login` |
| Upstash | `upstash` | `redis create`, `redis get` | `upstash auth login` |
| PlanetScale | `pscale` | `database create`, `branch create` | `pscale auth login` |
| GitHub | `gh` | `repo create`, `pr create`, `secret set` | `gh auth login` |
| Node | `npm`/`pnpm` | `install`, `run build`, `test`, `run dev` | N/A |
| Xcode | `xcodebuild` | `-project`, `-scheme`, `build`, `test` | N/A |
| Convex | `npx convex` | `dev`, `deploy`, `env set`, `env get` | `npx convex login` |

## Environment Variable Automation

**Env files:** Use Write/Edit tools. Never ask human to create .env manually.

**Dashboard env vars via CLI:**

| Platform | CLI Command | Example |
|----------|-------------|---------|
| Convex | `npx convex env set` | `npx convex env set OPENAI_API_KEY sk-...` |
| Vercel | `vercel env add` | `vercel env add STRIPE_KEY production` |
| Railway | `railway variables set` | `railway variables set API_KEY=value` |
| Fly | `fly secrets set` | `fly secrets set DATABASE_URL=...` |
| Supabase | `supabase secrets set` | `supabase secrets set MY_SECRET=value` |

**Pattern for secret collection:**
```xml
<!-- WRONG: Asking user to add env vars in dashboard -->
<task type="checkpoint:human-action">
  <action>Add OPENAI_API_KEY to Convex dashboard</action>
  <instructions>Go to dashboard.convex.dev → Settings → Environment Variables → Add</instructions>
</task>

<!-- RIGHT: Claude asks for value, then adds via CLI -->
<task type="checkpoint:human-action">
  <action>Provide your OpenAI API key</action>
  <instructions>
    I need your OpenAI API key to configure the Convex backend.
    Get it from: https://platform.openai.com/api-keys
    Paste the key (starts with sk-)
  </instructions>
  <verification>I'll add it via `npx convex env set` and verify it's configured</verification>
  <resume-signal>Paste your API key</resume-signal>
</task>

<task type="auto">
  <name>Configure OpenAI key in Convex</name>
  <action>Run `npx convex env set OPENAI_API_KEY {user-provided-key}`</action>
  <verify>`npx convex env get OPENAI_API_KEY` returns the key (masked)</verify>
</task>
```

## Dev Server Automation

**Claude starts servers, user visits URLs:**

| Framework | Start Command | Ready Signal | Default URL |
|-----------|---------------|--------------|-------------|
| Next.js | `npm run dev` | "Ready in" or "started server" | http://localhost:3000 |
| Vite | `npm run dev` | "ready in" | http://localhost:5173 |
| Convex | `npx convex dev` | "Convex functions ready" | N/A (backend only) |
| Express | `npm start` | "listening on port" | http://localhost:3000 |
| Django | `python manage.py runserver` | "Starting development server" | http://localhost:8000 |

### Server Lifecycle Protocol

**Starting servers:**
```bash
# Run in background, capture PID for cleanup
npm run dev &
DEV_SERVER_PID=$!

# Wait for ready signal (max 30s)
timeout 30 bash -c 'until curl -s localhost:3000 > /dev/null 2>&1; do sleep 1; done'
```

**Port conflicts:**
If default port is in use, check what's running and either:
1. Kill the existing process if it's stale: `lsof -ti:3000 | xargs kill`
2. Use alternate port: `npm run dev -- --port 3001`

**Server stays running** for the duration of the checkpoint. After user approves, server continues running for subsequent tasks. Only kill explicitly if:
- Plan is complete and no more verification needed
- Switching to production deployment
- Port needed for different service

**Pattern:**
```xml
<!-- Claude starts server before checkpoint -->
<task type="auto">
  <name>Start dev server</name>
  <action>Run `npm run dev` in background, wait for ready signal</action>
  <verify>curl http://localhost:3000 returns 200</verify>
  <done>Dev server running</done>
</task>

<!-- User only visits URL -->
<task type="checkpoint:human-verify">
  <what-built>Feature X - dev server running at http://localhost:3000</what-built>
  <how-to-verify>
    Visit http://localhost:3000/feature and verify:
    1. [Visual check 1]
    2. [Visual check 2]
  </how-to-verify>
</task>
```

## CLI Installation Handling

**When a required CLI is not installed:**

| CLI | Auto-install? | Command |
|-----|---------------|---------|
| npm/pnpm/yarn | No - ask user | User chooses package manager |
| vercel | Yes | `npm i -g vercel` |
| gh (GitHub) | Yes | `brew install gh` (macOS) or `apt install gh` (Linux) |
| stripe | Yes | `npm i -g stripe` |
| supabase | Yes | `npm i -g supabase` |
| convex | No - use npx | `npx convex` (no install needed) |
| fly | Yes | `brew install flyctl` or curl installer |
| railway | Yes | `npm i -g @railway/cli` |

**Protocol:**
1. Try the command
2. If "command not found", check if auto-installable
3. If yes: install silently, retry command
4. If no: create checkpoint asking user to install

```xml
<!-- Example: vercel not found -->
<task type="auto">
  <name>Install Vercel CLI</name>
  <action>Run `npm i -g vercel`</action>
  <verify>`vercel --version` succeeds</verify>
  <done>Vercel CLI installed</done>
</task>
```

## Pre-Checkpoint Automation Failures

**When setup fails before checkpoint:**

| Failure | Response |
|---------|----------|
| Server won't start | Check error output, fix issue, retry (don't proceed to checkpoint) |
| Port in use | Kill stale process or use alternate port |
| Missing dependency | Run `npm install`, retry |
| Build error | Fix the error first (this is a bug, not a checkpoint issue) |
| Auth error | Create auth gate checkpoint |
| Network timeout | Retry with backoff, then checkpoint if persistent |

**Key principle:** Never present a checkpoint with broken verification environment. If `curl localhost:3000` fails, don't ask user to "visit localhost:3000".

```xml
<!-- WRONG: Checkpoint with broken environment -->
<task type="checkpoint:human-verify">
  <what-built>Dashboard (server failed to start)</what-built>
  <how-to-verify>Visit http://localhost:3000...</how-to-verify>
</task>

<!-- RIGHT: Fix first, then checkpoint -->
<task type="auto">
  <name>Fix server startup issue</name>
  <action>Investigate error, fix root cause, restart server</action>
  <verify>curl http://localhost:3000 returns 200</verify>
  <done>Server running correctly</done>
</task>

<task type="checkpoint:human-verify">
  <what-built>Dashboard - server running at http://localhost:3000</what-built>
  <how-to-verify>Visit http://localhost:3000/dashboard...</how-to-verify>
</task>
```

## Quick Reference

| Action | Automatable? | Claude does it? |
|--------|--------------|-----------------|
| Deploy to Vercel | Yes (`vercel`) | YES |
| Create Stripe webhook | Yes (API) | YES |
| Write .env file | Yes (Write tool) | YES |
| Create Upstash DB | Yes (`upstash`) | YES |
| Run tests | Yes (`npm test`) | YES |
| Start dev server | Yes (`npm run dev`) | YES |
| Add env vars to Convex | Yes (`npx convex env set`) | YES |
| Add env vars to Vercel | Yes (`vercel env add`) | YES |
| Seed database | Yes (CLI/API) | YES |
| Click email verification link | No | NO |
| Enter credit card with 3DS | No | NO |
| Complete OAuth in browser | No | NO |
| Visually verify UI looks correct | No | NO |
| Test interactive user flows | No | NO |

</automation_reference>

</checkpoint_execution>
