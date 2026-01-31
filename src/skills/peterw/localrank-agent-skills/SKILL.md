---
name: LocalRank
description: Track local rankings, run SEO audits, and manage agency clients using LocalRank
author: LocalRank
repository: https://github.com/peterw/localrank-agent-skills
---

# LocalRank Skill

Track local rankings, run SEO audits, and manage agency clients using LocalRank.

**Last updated:** 2026-01-30

> Freshness check: If more than 30 days have passed since the last-updated date above, inform the user that this skill may be outdated and point them to the update options below.

## Keeping This Skill Updated

**Source:** github.com/peterw/localrank-agent-skills
**API docs:** app.localrank.so/settings/api

| Installation | How to update |
|-------------|---------------|
| CLI (npx skills) | `npx skills update` |
| Claude Code plugin | `/plugin update localrank@localrank-skills` |
| Cursor | Remote rules auto-sync from GitHub |
| Manual | Pull latest from repo or re-copy skills/localrank/ |

---

## Setup

Before using this skill, ensure:

1. **API Key:** Run the setup command to configure your API key securely
   - Get your key at https://app.localrank.so/settings/api
   - Run: `<skill-path>/scripts/localrank.js setup`
   - Or set environment variable: `export LOCALRANK_API_KEY=lr_your_key`

2. **Requirements:** Node.js 18+ (uses built-in fetch). No other dependencies needed.

**Config priority (highest to lowest):**
1. `LOCALRANK_API_KEY` environment variable
2. `./.localrank/config.json` (project-local)
3. `~/.config/localrank/config.json` (user-global)

### Handling "API key not found" errors

**CRITICAL:** When you receive an "API key not found" error:

1. **Tell the user to run setup** - The setup is interactive. Recommend they run:
   ```
   <skill-path>/scripts/localrank.js setup
   ```

2. **Stop and wait** - Do not continue with tasks. Wait for the user to complete setup.

**DO NOT** attempt to search for API keys in other locations or guess credentials.

---

## What LocalRank Does

LocalRank helps local SEO agencies track and improve Google Business Profile rankings:

- **Rank Tracking:** Visual grid maps showing where businesses rank across a geographic area
- **GMB Audits:** Analyze any Google Business Profile for issues and opportunities
- **LocalBoost:** Build citations on 50+ directories to improve local authority
- **SuperBoost:** Premium GBP optimization with AI-powered improvements
- **Review Booster:** Collect more Google reviews from happy customers

---

## Common Actions

| User says... | Action |
|-------------|--------|
| "How are my clients doing?" | `portfolio:summary` |
| "Check rankings for Acme Plumbing" | `client:report --business "Acme"` |
| "What should I work on today?" | `prioritize:today` |
| "Find easy wins" | `quick-wins:find` |
| "Which clients might churn?" | `at-risk:clients` |
| "Run an audit on this business" | `audit:run --url "..."` |
| "Draft an update email for Acme" | `email:draft --business "Acme"` |
| "How can I help this client rank better?" | `recommendations:get --business "..."` |

---

## Workflow

### Morning Check-in
```bash
# See what needs attention today
./scripts/localrank.js prioritize:today

# Quick overview of all clients
./scripts/localrank.js portfolio:summary
```

### Client Call Prep
```bash
# Get full report for a client
./scripts/localrank.js client:report --business "Acme Plumbing"

# Get recommendations for improvement
./scripts/localrank.js recommendations:get --business "Acme Plumbing"
```

### Finding Opportunities
```bash
# Keywords close to page 1 (easy wins)
./scripts/localrank.js quick-wins:find

# Clients at risk of churning
./scripts/localrank.js at-risk:clients
```

### Prospect Audits
```bash
# Run a GMB audit (costs 500 credits)
./scripts/localrank.js audit:run --url "https://google.com/maps/place/..."

# Check audit results
./scripts/localrank.js audit:get <audit_id>
```

---

## Commands Reference

### Setup & Config

| Command | Description |
|---------|-------------|
| `setup` | Interactive setup - prompts for API key |
| `setup --key <key>` | Non-interactive setup |
| `config:show` | Show current config and API key source |

### Clients & Businesses

| Command | Description |
|---------|-------------|
| `businesses:list` | List all tracked businesses |
| `businesses:list --search "name"` | Search by business name |

### Rankings & Scans

| Command | Description |
|---------|-------------|
| `scans:list` | List recent ranking scans |
| `scans:list --business "name"` | Filter scans by business |
| `scans:list --limit 20` | Limit results (max 50) |
| `scans:get <scan_id>` | Get detailed scan with keyword rankings |

### Reports

| Command | Description |
|---------|-------------|
| `client:report --business "name"` | Full client report comparing recent scans. Shows wins, drops, visual map URL |
| `portfolio:summary` | Overview of all clients - improving, declining, stable |
| `prioritize:today` | What to work on right now - urgent items and quick wins |
| `quick-wins:find` | Keywords ranking 11-20 that could reach page 1 |
| `quick-wins:find --business "name"` | Quick wins for specific client |
| `at-risk:clients` | Clients who might churn - ranking drops, low engagement |

### GMB Audits

| Command | Description |
|---------|-------------|
| `audit:run --url "google.com/maps/..."` | Run GMB audit (500 credits). Returns audit_id |
| `audit:get <audit_id>` | Get audit results - score, issues, recommendations |

### Tools

| Command | Description |
|---------|-------------|
| `recommendations:get --business "name"` | How to help a client rank better. Suggests products |
| `email:draft --business "name"` | Generate monthly update email for a client |

---

## Examples

### Check portfolio health
```bash
./scripts/localrank.js portfolio:summary
```
Returns:
```json
{
  "total_clients": 15,
  "improving": 8,
  "declining": 2,
  "stable": 5,
  "avg_rank_across_portfolio": 7.3,
  "clients": [...]
}
```

### Get client report
```bash
./scripts/localrank.js client:report --business "Acme Plumbing"
```
Returns:
```json
{
  "business_name": "Acme Plumbing",
  "latest_scan": {
    "date": "2026-01-28",
    "avg_rank": 4.2,
    "keywords": [...]
  },
  "wins": [
    {"keyword": "plumber near me", "from": 8.5, "to": 3.2, "improved_by": 5.3}
  ],
  "drops": [],
  "view_url": "https://app.localrank.so/share/abc123"
}
```

### Find quick wins
```bash
./scripts/localrank.js quick-wins:find
```
Returns keywords ranking 11-20 across all clients - these are close to page 1 and easy to push up.

### Run a GMB audit
```bash
./scripts/localrank.js audit:run --url "https://google.com/maps/place/..."
# Wait for completion
./scripts/localrank.js audit:get <audit_id>
```

### Draft client email
```bash
./scripts/localrank.js email:draft --business "Acme Plumbing"
```
Returns a ready-to-send monthly update email with rankings, wins, and visual map link.

---

## Understanding the Data

### Ranking Values
- **avg_rank:** Average position across the geographic grid (lower is better)
- **best_rank:** Best position found in any grid point
- Rankings 1-3 are in the "Local Pack" (visible on Google Maps)
- Rankings 4-10 are "page 1"
- Rankings 11-20 are "quick wins" - close to visibility

### Visual Maps
Most responses include a `view_url` like `https://app.localrank.so/share/abc123`
- Share these with clients to show ranking coverage
- The grid shows where the business ranks from different locations

### Status Values
- **improving:** Rankings got better since last scan
- **declining:** Rankings dropped (needs attention)
- **stable:** Rankings unchanged
- **new:** Only one scan, no comparison data yet

---

## Products to Recommend

When `recommendations:get` suggests products:

| Product | When to use | What it does |
|---------|-------------|--------------|
| **SuperBoost** | Avg rank > 10 | AI-powered GBP optimization, premium citations |
| **LocalBoost** | Avg rank 5-10 | Build 50+ citations to increase local authority |
| **ContentBoost** | Avg rank > 7 | AI-generated local content for topical authority |
| **Review Booster** | Any client | Collect more Google reviews automatically |
| **Rank Tracker** | < 5 keywords | Track more keywords to measure impact |

---

## Tips

- **Visual proof:** Always include the `view_url` when showing clients their rankings
- **Quick wins first:** Keywords at rank 11-15 are easiest to push to page 1
- **Audit before proposal:** Run `audit:run` on prospects to show them issues
- **Proactive communication:** Use `at-risk:clients` to catch churn early
- **Batch operations:** Use `portfolio:summary` for monthly reviews of all clients

---

## Support

Questions? support@localrank.so
