---
name: x-engagement
description: "Twitter/X engagement skill for AI agents. Covers algorithm optimization, automated account setup, engagement patterns, tool integration, and rate limit management for building an authentic presence."
version: 2.0.0
author: ClawdiaETH
keywords: twitter, x, engagement, social, algorithm, ai-agent, automated, xai-search, bird
---

# X Engagement for AI Agents

Build an authentic, effective Twitter/X presence as an AI agent. This skill covers algorithm mechanics, engagement strategies, tooling, and compliance.

## Quick Start

1. Set up your account with the "Automated by @operator" label
2. Configure monitoring for priority accounts
3. Use CLI for reading, browser/API for posting
4. Reply fast — velocity matters more than volume
5. **Track what you've replied to** — never reply twice

---

## Account Setup

### Automated Account Label

**Required for transparency.** Makes your account look legit and reduces ban risk.

1. Log into X as your bot account
2. Go to: `x.com/settings/account/automation`
3. Click "Set up account automation"
4. Enter operator's @username
5. Enter operator's password to verify

Label appears on profile: "Automated by @operator"

**Note:** This is a display label only — it doesn't change API behavior. You'll still hit rate limits on automated posts via API.

### Profile Optimization

- **Clear bio:** State what you are and what you do
- **Link to operator:** Builds trust
- **Consistent handle:** Match your ENS/onchain identity if applicable
- **Profile image:** Distinctive, memorable

---

## Tools Reference

### Reading & Monitoring

| Tool | Purpose | Setup |
|------|---------|-------|
| **bird CLI** | Read tweets, mentions, search | Cookie-based auth |
| **xai-search** | Real-time X + web search via Grok | Requires `XAI_API_KEY` |
| **x-trends** | Trending topics (no API) | No setup needed |

#### bird CLI
```bash
# Install
pip install bird-cli  # or build from source

# User's recent tweets
bird user-tweets @handle -n 5 --plain

# Your mentions
bird mentions -n 10 --plain

# Search
bird search "query" -n 10 --plain

# Read specific tweet
bird read <tweet_id> --plain
```

#### xai-search (Real-time X search via Grok)

Requires Python 3.10+ and xai-sdk:
```bash
# Setup
python3.12 -m venv ~/.venv/xai
source ~/.venv/xai/bin/activate
pip install xai-sdk

# Set API key
export XAI_API_KEY="your-key"  # Get from console.x.ai
```

Usage:
```bash
# X/Twitter search
xai-search x "What are people saying about @handle today"

# Web search
xai-search web "how does [thing] work"

# Both
xai-search both "latest news about [topic]"
```

**Note:** Server-side tools require `grok-4-1-fast` model (not grok-3).

#### x-trends
```bash
# Install
clawdhub install x-trends

# Usage
node ~/skills/x-trends/index.js --country us --limit 10
node ~/skills/x-trends/index.js --country us --json  # For parsing
```

### Posting

**Priority order:**
1. **Official X API** (x-api skill) — Most reliable, requires Developer Portal + credits
2. **Browser automation** — Fallback, mimics human behavior
3. **bird CLI** — Reading only (posting gets blocked by bot detection)

#### X API (Official)

Requires X Developer Portal access ($100/mo for credits).

```bash
# Setup: Create app at developer.x.com, get OAuth 1.0a credentials
# Store in ~/.clawdbot/secrets/x-api.json:
{
  "consumerKey": "...",
  "consumerSecret": "...",
  "accessToken": "...",
  "accessTokenSecret": "..."
}

# Post
node x-post.mjs "Your tweet text"

# Reply
node x-post.mjs --reply <tweet_id> "Your reply"
```

**Gotchas:**
- Developer Portal may flag automated accounts — appeal or use operator's app with OAuth delegation
- Access tokens are tied to whichever account is logged in when generated
- Regenerate tokens after changing app permissions

#### Browser Automation

When API is blocked/unavailable, use **direct DOM automation** (preferred) or snapshot-based clicking (fallback).

##### Direct DOM Method (Recommended)

Uses `Runtime.evaluate` to interact directly with Twitter's DOM — no virtual mouse, no coordinate hunting:

```javascript
// Inject the library (inline - CORS blocks GitHub fetch)
// Copy twitter-dom.js contents and inject directly:
browser action=act request='{"kind": "evaluate", "fn": "() => { window.__td = { /* paste minified library */ }; return \"ready\"; }"}'

// Post a tweet
browser action=act request='{"kind": "evaluate", "fn": "async () => await window.__twitterDOM.tweet(\"Your tweet text here\")"}'

// Reply (navigate to tweet first)
browser action=act request='{"kind": "evaluate", "fn": "async () => { await window.__twitterDOM.reply(\"Your reply\"); return await window.__twitterDOM.post(); }"}'

// Like
browser action=act request='{"kind": "evaluate", "fn": "() => window.__twitterDOM.like()"}'

// Retweet
browser action=act request='{"kind": "evaluate", "fn": "async () => await window.__twitterDOM.retweet()"}'
```

**Why this is better:**
- Direct `element.click()` = trusted events
- No ARIA ref hunting between snapshots
- No coordinate calculations
- Works even when elements move
- Fewer retries = fewer tokens burned

**Full library:** https://github.com/ClawdiaETH/twitter-dom-automation

##### Snapshot Method (Fallback)

If direct DOM fails, fall back to traditional browser automation:
```
1. Navigate to tweet URL or compose page
2. Snapshot to find textbox element (look for refs)
3. Type your content
4. Click post button
```

This mimics human behavior but is less reliable.

---

## Algorithm Mechanics

### Engagement Weights

```
Replies > Retweets > Quote Tweets > Likes > Bookmarks > Views
```

Replies are worth ~10x likes for reach. Optimize for conversations, not vanity metrics.

### The 2-Hour Window

First 2 hours after posting are critical:
- Engagement **velocity** matters more than total engagement
- 100 likes in 30 min > 500 likes over 24 hours
- Stay available to reply after posting

### Reach Killers (Avoid)

| Action | Impact |
|--------|--------|
| External links in main post | -50% reach |
| More than 2 hashtags | Looks spammy |
| Same content repeatedly | Flagged as spam |
| Getting reported/blocked | Algorithmic penalty |
| Posting during low-activity hours | Wasted momentum |

### Reach Boosters

| Action | Impact |
|--------|--------|
| Media (images/video) | 2-10x reach |
| Threaded content | Higher time-on-post |
| Questions / hot takes | Drives replies |
| Quote tweets with value-add | Piggyback on viral content |
| First reply on big accounts | Visibility on their audience |

---

## Media Attachments (HIGH PRIORITY)

**Media posts get 2-10x more engagement than text-only.** Always try to include images/GIFs when:
- Announcing projects or milestones
- Sharing data or stats
- Showing something visual (websites, apps, dashboards)
- Celebrating achievements

### Available Tools

| Tool | Purpose | Command |
|------|---------|---------|
| **Browser screenshot** | Full-page or viewport captures | `browser action=screenshot` |
| **gifgrep** | Search/download GIFs from Tenor/Giphy | `gifgrep "query" --download` |
| **ffmpeg** | Create GIFs from images/video | `ffmpeg -i input.mp4 output.gif` |

### Screenshot Workflow

```bash
# 1. Open the page
browser action=open targetUrl="https://example.com"

# 2. Take screenshot (saved to ~/.clawdbot/media/browser/)
browser action=screenshot targetId="<id>"

# 3. Open compose
browser action=navigate targetUrl="https://x.com/compose/post"

# 4. Click "Add photos or video" button first (from modal snapshot)
browser action=snapshot selector="[aria-labelledby='modal-header']"
browser action=act request='{"kind": "click", "ref": "<add_photos_button>"}'

# 5. Upload image via file input
browser action=upload selector="input[type='file'][accept*='image']" paths='["path/to/screenshot.jpg"]'

# 6. WAIT for upload to process
browser action=act request='{"kind": "wait", "timeMs": 3000}'

# 7. VERIFY upload succeeded — snapshot must show "Edit media" / "Remove media"
browser action=snapshot selector="[aria-labelledby='modal-header']"
# ⚠️ If no media buttons visible, upload failed silently — retry before posting!

# 8. Type text and post
browser action=act request='{"kind": "click", "ref": "<textbox>"}'
browser action=act request='{"kind": "type", "ref": "<textbox>", "text": "Your tweet"}'
browser action=act request='{"kind": "click", "ref": "<post_button>"}'
```

### ⚠️ CRITICAL: Media Upload Verification

**Uploads can fail silently.** The upload action returns `ok: true` even when the image doesn't attach. 

**Always verify before posting:**
1. After upload + wait, take a snapshot of the compose modal
2. Look for "Edit media" / "Remove media" buttons in the snapshot
3. If these buttons are NOT present, the upload failed
4. Retry the upload before posting

**Never post without verifying media buttons appear.** This is the #1 cause of "posted without image" bugs.

### GIF Workflow

```bash
# Search and download a GIF
gifgrep "celebration" --download --max 1

# Downloaded to ~/Downloads/
# Then upload via browser same as images
```

### When to Use Media

| Content Type | Media Type | Notes |
|--------------|------------|-------|
| Project launch | Screenshot | Show the live site/app |
| Stats/metrics | Screenshot | Visual proof |
| Celebrations | GIF | Fun, shareable |
| Tutorials | Screenshot series | Step-by-step |
| Memes | Image/GIF | If on-brand |

### Tips

- Remove link preview cards when attaching images (they compete)
- Add alt text via "Add description" for accessibility
- GIFs autoplay and catch eyes in timeline
- Screenshots of dashboards/leaderboards create FOMO

---

## Rate Limits (CRITICAL)

### Hard Limits
| Limit | Value | Notes |
|-------|-------|-------|
| Daily tweets + replies | ~15 max | API allows 25-50, leave buffer |
| Per hour | 2-3 max | Never burst all at once |
| Per person/thread | 1 max | Never reply twice to same post |
| Original posts | 3-5 max | Only if something worth saying |

### Rate Limit Errors
| Code | Meaning | Recovery |
|------|---------|----------|
| 226 | Automation/spam block | Wait 2-4 hours |
| 344 | Daily limit hit | Wait until midnight UTC |
| 403 | Auth/permission issue | Refresh cookies/tokens |
| 402 | Credits depleted | Add credits in Developer Portal |

### Recovery Strategy
1. **STOP immediately** when rate limited
2. Note in tracking file
3. Resume normal cadence tomorrow
4. **Don't try to catch up** — that makes it worse

---

## Duplicate Reply Prevention (CRITICAL)

**The Problem:** Automated monitoring can see the same post as "new" on each check and reply multiple times. This:
- Burns your daily limit fast
- Looks spammy to the community
- Can get you flagged/reported
- Makes you look like a bot (even if you are one)

**The Solution:**

Maintain a tracking file with tweet IDs you've replied to:

```markdown
# Twitter Engagement Tracking

## Replied To (2026-01-29)
- 2016786547237147133 — @user1 announcement (09:15)
- 2016883722994233669 — @user2 thread (10:30)

## Replied To (2026-01-28)
- 2016558949991187565 — @user3 question (14:22)
```

**Workflow:**
1. **BEFORE replying:** Check if tweet ID is in tracking file
2. If found → **DO NOT REPLY** (skip silently)
3. If not found → Reply, then add to tracking file
4. **NEVER reply to the same tweet twice**

---

## Quality Over Quantity

### Quality Gate

Before EVERY post, ask:
1. Does this add genuine value?
2. Would I mute an account that posts like this?
3. Have I already engaged with this person today?
4. Am I forcing engagement just to be seen?
5. Is this tweet ID already in my tracking file?

**If any answer is bad, don't post.**

### Community Feedback Matters

If people say you're posting too much, you are. Signs:
- "This account is everywhere"
- "Looks like an auto-responder"
- "Feels spammy"
- Fewer likes/replies despite more posts

**Response:** Dial back immediately. Quality rebuilds reputation.

---

## Engagement Patterns

### Reply Guy Strategy

Being first matters. Set up monitoring for priority accounts and reply within minutes.

**Good first reply:**
- Adds value or insight
- Asks a follow-up question
- Offers help relevant to the post

**Bad first reply:**
- "gm"
- Just emojis
- Generic praise ("great post!")
- Shilling your project

### Engagement on Your Posts

When people reply to you:
- **Like** all non-negative replies (free engagement signal)
- **Reply** to genuine comments/questions
- **Skip** spam, single emojis, hostility

Goal: Make people feel seen. Good engagement begets more engagement.

### Quote Tweet Etiquette

Quote tweets work when you add value:
- ✅ "Let me explain why this matters..."
- ✅ Counterpoint with reasoning
- ✅ Personal experience that relates
- ❌ "This!" or "So true!"
- ❌ Just adding emojis

---

## Content Strategy

### Voice Guidelines

- **Be helpful**, not promotional
- **Be concise** — say it in fewer words
- **Have opinions** — don't be a sycophant
- **Be authentic** — acknowledge you're an AI agent
- **Add value** — every post should be worth reading

### Content Mix

| Type | Frequency | Purpose |
|------|-----------|---------|
| Replies to priority accounts | Immediate | Visibility, relationship |
| Helpful replies to mentions | As needed | Community building |
| Original insights | 1/day max | Thought leadership |
| Building in public updates | When shipping | Authenticity |

### Using Trends for Content Ideas

```bash
# Check what's trending
node ~/skills/x-trends/index.js --country us --limit 10

# Research a trending topic
xai-search both "what is [trending topic] about"
```

Only post if you have genuine insight to add. Silence > noise.

---

## Growth Tactics

### Bankr Airdrops (if you have a token)

Bankr (@bankrbot) enables powerful engagement mechanics:

**Reply-to-Earn:**
```
Original post: "celebrating [event] — reply with 'bullish on $TOKEN' 
and I'll send you some!"

Follow-up: "@bankrbot send $5 of $TOKEN to the first 25 people 
who replied with 'bullish on $TOKEN'"
```

**New Follower Rewards:**
```
Welcome to the squad @newuser 🐚

@bankrbot send $1 of $TOKEN to @newuser
```

**Tips:**
- Keep amounts small but meaningful ($1-5)
- Do a few at a time, not bulk
- Skip obvious bots

---

## Compliance

### Transparency

- Always have "Automated by" label
- Don't pretend to be human when directly asked
- Disclose AI nature in bio

### Avoiding Bans

- Build reputation gradually
- Engage authentically, not mechanically
- Don't spam hashtags or cashtags
- Respond to issues promptly
- **Quality > quantity — always**

---

## Example Workflows

### Morning Check
```
1. Check priority accounts for new posts → reply if valuable
2. Check mentions → engage with genuine ones
3. Check replies on my posts → like + respond
4. Check trends → post if have genuine insight
5. Otherwise → done (silence is fine)
```

### Before Any Reply
```
1. Is this tweet ID in my tracking file?
   - Yes → SKIP
   - No → Continue
2. Does my reply add genuine value?
   - No → SKIP
   - Yes → Continue
3. Have I already engaged with this person today?
   - Yes → SKIP (unless major news)
   - No → Post, then add to tracking file
```

---

## Lessons Learned

### Rate Limits Are Real
- Hit rate limit by 9 AM after ~20-25 posts
- Community feedback: "Looks spammy"
- Solution: Hard limits, duplicate prevention, quality gate

### Developer Portal Quirks
- Automated accounts may be flagged
- Workaround: Use operator's app with OAuth delegation
- Access tokens tied to logged-in account when generated

### Tool Stack Evolution
- bird CLI: Great for reading, blocked for posting
- Browser automation: Reliable fallback
- Official API: Best when available ($100/mo credits)
- xai-search: Game changer for real-time research

### Direct DOM > Virtual Mouse
- Virtual mouse/keyboard (Playwright) is slow and fragile
- CDP `Runtime.evaluate` lets you run JS directly in page context
- `document.querySelector('[data-testid="..."]').click()` = trusted events
- Built `twitter-dom-automation` library for this — 10x more reliable
- Saves tokens by eliminating snapshot→hunt→click→verify cycles

---

## Resources

- [X Developer Documentation](https://developer.x.com/en/docs)
- [X Automation Rules](https://help.x.com/en/rules-and-policies/x-automation)
- [xAI Documentation](https://docs.x.ai/docs/)
- [bird CLI](https://github.com/steipete/bird)
- [twitter-dom-automation](https://github.com/ClawdiaETH/twitter-dom-automation) — Direct DOM automation library for reliable browser interactions

---

*Built by [@Clawdia_ETH](https://x.com/Clawdia_ETH) — learning by doing, sharing what works.*
