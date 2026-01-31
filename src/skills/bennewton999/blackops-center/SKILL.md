---
name: blackops-center
description: Control your BlackOps Center sites from Clawdbot - create, publish, and manage blog posts via API.
homepage: https://github.com/BlackOpsCenter/clawdbot-skill
metadata: {"clawdbot":{"emoji":"📝","requires":{"bins":["curl","jq"]}}}
---

# BlackOps Center Skill

Control your BlackOps Center sites from Clawdbot. Create, publish, and manage blog posts via API.

## Setup

1. **Generate an API token** in BlackOps Center:
   - Go to Settings → Browser Extension
   - Copy your Personal Access Token

2. **Configure the skill**:
   ```bash
   cd ~/.clawdbot/skills/blackops-center
   cp config.example.yaml config.yaml
   # Edit config.yaml and paste your token
   ```

## Configuration

Create `config.yaml`:

```yaml
api_token: "your-token-here"
base_url: "https://blackopscenter.com"  # or your custom domain
```

## Available Commands

All commands use the `blackops-center` CLI wrapper.

### List Sites

Show all sites you have access to:

```bash
blackops-center list-sites
```

Returns JSON with your sites and which one is active for this token.

### List Posts

List posts for your site:

```bash
# List all posts
blackops-center list-posts

# List only published posts
blackops-center list-posts --status published

# List only drafts
blackops-center list-posts --status draft

# Limit results
blackops-center list-posts --limit 10
```

### Get a Post

Get full details of a specific post:

```bash
blackops-center get-post <post-id>
```

### Create a Post

Create a new draft post:

```bash
blackops-center create-post \
  --title "My Post Title" \
  --content "Post content in markdown" \
  --excerpt "Optional excerpt" \
  --tags "tag1,tag2,tag3"
```

All posts are created as drafts by default.

### Update a Post

Update an existing post:

```bash
# Update title
blackops-center update-post <post-id> --title "New Title"

# Update content
blackops-center update-post <post-id> --content "New content"

# Publish a draft
blackops-center update-post <post-id> --status published

# Unpublish (back to draft)
blackops-center update-post <post-id> --status draft
```

You can combine multiple flags to update multiple fields at once.

### Delete a Post

```bash
blackops-center delete-post <post-id>
```

## Usage from Clawdbot

When you invoke this skill from a Clawdbot session, you can use natural language:

**User:** "Create a blog post about AI agents titled 'The Future of Automation'"

**Assistant will:**
1. Extract title and content from your message
2. Run `blackops-center create-post --title "..." --content "..."`
3. Return the post ID and preview URL

**User:** "Publish post abc123"

**Assistant will:**
1. Run `blackops-center update-post abc123 --status published`
2. Confirm publication and provide the live URL

**User:** "Show me my recent draft posts"

**Assistant will:**
1. Run `blackops-center list-posts --status draft --limit 10`
2. Format the results in a readable way

## API Details

This skill uses the BlackOps Center Extension API (`/api/ext/*`):

- `GET /api/ext/sites` - List sites
- `GET /api/ext/posts` - List posts
- `POST /api/ext/posts` - Create post
- `GET /api/ext/posts/:id` - Get post
- `PUT /api/ext/posts/:id` - Update post
- `DELETE /api/ext/posts/:id` - Delete post

All requests require `Authorization: Bearer <token>` header.

## Error Handling

- **401 Unauthorized**: Token is invalid or revoked. Generate a new token in BlackOps Center.
- **404 Site not found**: The domain associated with your token doesn't exist.
- **404 Post not found**: Post ID doesn't exist or belongs to a different site.
- **400 Bad Request**: Missing required fields (e.g., title, content for create).

## Examples

### Create and publish workflow

```bash
# Create draft
POST_ID=$(blackops-center create-post \
  --title "My Post" \
  --content "# My Post\n\nGreat content here." | jq -r '.post.id')

# Review, edit if needed...

# Publish when ready
blackops-center update-post "$POST_ID" --status published
```

### Bulk operations

```bash
# Get all draft posts
DRAFTS=$(blackops-center list-posts --status draft)

# Publish all drafts (careful!)
echo "$DRAFTS" | jq -r '.posts[].id' | while read id; do
  blackops-center update-post "$id" --status published
done
```

## Troubleshooting

**"Unauthorized" error:**
- Verify your token in `config.yaml`
- Check token hasn't been revoked in BlackOps Center
- Generate a new token if needed

**"Site not found":**
- Each token is tied to a specific site domain
- If you need to manage multiple sites, generate separate tokens for each

**Command not found:**
- Make sure `bin/` is executable: `chmod +x ~/.clawdbot/skills/blackops-center/bin/*`
- Skill should be installed via ClawdHub or symlinked to `~/.clawdbot/skills/`

## Development

Test the API directly with curl:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://blackopscenter.com/api/ext/posts
```

## Support

- BlackOps Center: https://blackopscenter.com
- Issues: https://github.com/clawdbot/skills (if published)
- Documentation: This file
