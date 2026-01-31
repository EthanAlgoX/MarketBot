# BlackOps Center Skill for Clawdbot

Control your [BlackOps Center](https://blackopscenter.com) content from Clawdbot. Create, publish, and manage blog posts using natural language or direct CLI commands.

## What is BlackOps Center?

BlackOps Center is a Content Operating System for operators, founders, and technical leaders. It helps you turn ideas into outcomes through persistent memory, discovery bots, content generation, and analytics.

## What This Skill Does

This skill lets you interact with your BlackOps Center sites directly from Clawdbot:

- **List and search posts** across your site(s)
- **Create new posts** from conversation or direct commands
- **Publish drafts** with a simple command
- **Update existing content** without opening the web interface
- **Delete posts** when needed

Perfect for:
- Voice-driven content creation (via VoiceCommit + Clawdbot + BlackOps)
- Automated publishing workflows
- Quick post status changes
- Content audits and inventory
- Building custom automation on top of your content

## Installation

### Via ClawdHub (recommended)

```bash
clawdhub install blackops-center
```

### Manual Installation

1. Clone or download this skill to `~/.clawdbot/skills/blackops-center`
2. Copy `config.example.yaml` to `config.yaml`
3. Generate an API token in BlackOps Center (Settings → Browser Extension)
4. Paste your token into `config.yaml`

## Quick Start

1. **Get your API token:**
   - Log into BlackOps Center
   - Go to Settings → Browser Extension
   - Click "Regenerate Token" (or use existing if you have one)
   - Copy the token

2. **Configure the skill:**
   ```bash
   cd ~/.clawdbot/skills/blackops-center
   cp config.example.yaml config.yaml
   nano config.yaml  # paste your token
   ```

3. **Test it:**
   ```bash
   blackops-center list-sites
   blackops-center list-posts --status draft
   ```

4. **Use with Clawdbot:**
   - "Show me my recent draft posts in BlackOps"
   - "Create a blog post titled 'AI Automation in 2026'"
   - "Publish post abc123"

## Commands

All commands are available via the `blackops-center` CLI:

### `list-sites`
Show all sites you have access to and which one is active for your token.

```bash
blackops-center list-sites
```

### `list-posts`
List posts with optional filters.

```bash
blackops-center list-posts
blackops-center list-posts --status draft
blackops-center list-posts --status published --limit 10
```

### `get-post <id>`
Get full details of a specific post.

```bash
blackops-center get-post abc123-def456
```

### `create-post`
Create a new draft post.

```bash
blackops-center create-post \
  --title "My Post Title" \
  --content "Post content in markdown" \
  --excerpt "Optional excerpt" \
  --tags "ai,automation,productivity"
```

### `update-post <id>`
Update an existing post (including publishing).

```bash
# Publish a draft
blackops-center update-post abc123 --status published

# Update content
blackops-center update-post abc123 --content "New content"

# Update multiple fields
blackops-center update-post abc123 \
  --title "New Title" \
  --status published
```

### `delete-post <id>`
Delete a post (permanent).

```bash
blackops-center delete-post abc123
```

## Usage with Clawdbot

Once installed, Clawdbot can use this skill when you mention BlackOps Center in your requests:

**Example conversations:**

> **You:** "Create a blog post about the future of AI agents"
> 
> **Clawdbot:** [Creates draft post with generated content, returns post ID and preview URL]

> **You:** "Show me all my draft posts"
> 
> **Clawdbot:** [Lists drafts with titles, IDs, and creation dates]

> **You:** "Publish post abc123"
> 
> **Clawdbot:** [Updates status to published, confirms with live URL]

## Configuration

The `config.yaml` file supports:

```yaml
api_token: "your-token-here"     # Required: Your BlackOps Center API token
base_url: "https://blackopscenter.com"  # Optional: Custom domain if self-hosted
```

## Multi-Site Support

Each API token is tied to a specific site domain in BlackOps Center. If you manage multiple sites:

1. Generate separate tokens for each site
2. Create separate skill configs or manage multiple installations
3. Or switch tokens in `config.yaml` when changing sites

Future versions may support multi-site switching within a single config.

## API Reference

This skill uses the BlackOps Center Extension API:

- `GET /api/ext/sites` - List accessible sites
- `GET /api/ext/posts` - List posts (with filters)
- `POST /api/ext/posts` - Create post
- `GET /api/ext/posts/:id` - Get post
- `PUT /api/ext/posts/:id` - Update post
- `DELETE /api/ext/posts/:id` - Delete post

All endpoints require `Authorization: Bearer <token>` header.

## Troubleshooting

**"Unauthorized" error:**
- Verify your token in `config.yaml`
- Check if token was revoked in BlackOps Center
- Generate a new token

**"Site not found":**
- Your token is tied to a specific site domain
- Verify the domain in BlackOps Center settings

**Command not found:**
- Ensure scripts are executable: `chmod +x ~/.clawdbot/skills/blackops-center/bin/*`
- Check skill is installed in `~/.clawdbot/skills/`

**JSON parsing errors:**
- Ensure `jq` is installed: `brew install jq` (macOS) or `apt install jq` (Linux)

## Requirements

- Clawdbot (any recent version)
- BlackOps Center account with active site
- `jq` for JSON processing (usually pre-installed)
- `curl` for API requests (standard on macOS/Linux)

## Contributing

This skill is part of the BlackOps Center ecosystem. Issues and improvements:

- Skill issues: [ClawdHub repository](https://github.com/clawdbot/skills)
- BlackOps API issues: Contact support@blackopscenter.com
- Feature requests: Use the feedback form in BlackOps Center

## License

MIT License - See LICENSE file for details

## Links

- [BlackOps Center](https://blackopscenter.com)
- [Clawdbot](https://clawd.bot)
- [ClawdHub](https://clawdhub.com)
- [VoiceCommit](https://voicecommit.com) - Voice-first idea capture (pairs great with this workflow)
