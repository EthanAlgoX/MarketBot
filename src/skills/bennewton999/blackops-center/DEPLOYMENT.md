# BlackOps Center Skill - Deployment Guide

## What We Built

### 1. BlackOps Center API Endpoints
New extension API endpoints for managing posts:

**Files created:**
- `~/Projects/2024-blog/src/app/api/ext/posts/route.ts`
- `~/Projects/2024-blog/src/app/api/ext/posts/[id]/route.ts`

**Endpoints:**
- `GET /api/ext/posts` - List posts (with status/limit filters)
- `POST /api/ext/posts` - Create new post
- `GET /api/ext/posts/:id` - Get specific post
- `PUT /api/ext/posts/:id` - Update post (title, content, status, etc.)
- `DELETE /api/ext/posts/:id` - Delete post

**Authentication:**
Uses existing `extension_api_tokens` system with Bearer token validation.

### 2. Clawdbot Skill
Complete CLI skill for controlling BlackOps Center:

**Location:** `~/clawd/skills/blackops-center/`

**Files:**
- `SKILL.md` - Documentation for Clawdbot
- `README.md` - Public documentation for ClawdHub
- `package.json` - Publishing metadata
- `config.example.yaml` - Configuration template
- `bin/blackops-center` - Main CLI wrapper
- `bin/list-sites` - List accessible sites
- `bin/list-posts` - List posts with filters
- `bin/get-post` - Get single post
- `bin/create-post` - Create new post
- `bin/update-post` - Update existing post
- `bin/delete-post` - Delete post

## Deployment Steps

### Phase 1: Deploy API Endpoints

1. **Build and test BlackOps Center:**
   ```bash
   cd ~/Projects/2024-blog
   npm run build
   ```

2. **Test locally (optional):**
   ```bash
   npm run dev
   # In another terminal, test the endpoints
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/ext/posts
   ```

3. **Deploy to Vercel:**
   ```bash
   git add src/app/api/ext/posts
   git commit -m "feat: Add extension API endpoints for post management"
   git push origin main
   ```

   Vercel will auto-deploy. Monitor the deployment in the Vercel dashboard.

4. **Verify deployment:**
   ```bash
   # Get your token from BlackOps Center Settings → Browser Extension
   curl -H "Authorization: Bearer YOUR_ACTUAL_TOKEN" \
     https://blackopscenter.com/api/ext/posts
   ```

   Should return JSON with your posts.

### Phase 2: Test the Skill Locally

1. **Get your API token:**
   - Go to https://blackopscenter.com/admin/settings
   - Scroll to "Browser Extension"
   - Copy your Personal Access Token (or regenerate if needed)

2. **Configure the skill:**
   ```bash
   cd ~/clawd/skills/blackops-center
   cp config.example.yaml config.yaml
   # Edit config.yaml and paste your token
   ```

3. **Test each command:**
   ```bash
   # List sites
   ./bin/blackops-center list-sites

   # List posts
   ./bin/blackops-center list-posts

   # List only drafts
   ./bin/blackops-center list-posts --status draft

   # Create a test post
   ./bin/blackops-center create-post \
     --title "Test Post from CLI" \
     --content "This is a test post created via the BlackOps Center skill."

   # Get the post ID from the response, then:
   ./bin/blackops-center update-post <POST_ID> --status published

   # Clean up
   ./bin/blackops-center delete-post <POST_ID>
   ```

4. **Test with Clawdbot:**
   Start a Clawdbot session and try:
   - "Show me my draft posts in BlackOps"
   - "Create a blog post titled 'Testing the Skill' with content about AI automation"
   - "List my recent posts"

### Phase 3: Publish to ClawdHub

1. **Install ClawdHub CLI** (if not already installed):
   ```bash
   npm install -g clawdhub
   ```

2. **Login to ClawdHub:**
   ```bash
   clawdhub login
   ```

3. **Publish the skill:**
   ```bash
   cd ~/clawd/skills/blackops-center
   clawdhub publish
   ```

   This will:
   - Validate the skill structure
   - Package it for distribution
   - Upload to ClawdHub
   - Make it available via `clawdhub install blackops-center`

4. **Verify publication:**
   ```bash
   clawdhub search blackops-center
   ```

## Testing Checklist

Before publishing, verify:

- [ ] API endpoints deployed and accessible
- [ ] Token authentication works
- [ ] `list-sites` returns your sites
- [ ] `list-posts` returns your posts
- [ ] `create-post` creates a draft
- [ ] `update-post` can change status to published
- [ ] `update-post` can modify content
- [ ] `delete-post` removes the post
- [ ] Clawdbot can invoke commands via the skill
- [ ] All help text is accurate
- [ ] README is complete and accurate

## Troubleshooting

### API Returns 401 Unauthorized
- Check token is valid in BlackOps Center
- Verify token hasn't been revoked
- Generate new token and update config.yaml

### "Site not found" Error
- Token is tied to a specific domain
- Check which domain the token is associated with
- Verify that domain exists in your sites

### Command Not Found
- Ensure scripts are executable: `chmod +x bin/*`
- Check PATH if installed globally

### JSON Errors
- Install jq: `brew install jq` (macOS) or `apt install jq` (Linux)
- Verify jq is in PATH: `which jq`

## Future Enhancements

Possible additions:

1. **Multi-site support** - Switch between sites in a single config
2. **Bulk operations** - Publish multiple drafts at once
3. **Media upload** - Add hero images via CLI
4. **Content templates** - Pre-defined post structures
5. **Analytics** - View post performance metrics
6. **Search** - Full-text search across posts
7. **Export** - Download posts as markdown files
8. **Import** - Bulk import from other platforms

## Documentation Links

- [SKILL.md](./SKILL.md) - Skill documentation for Clawdbot
- [README.md](./README.md) - Public documentation
- [BlackOps Center](https://blackopscenter.com)
- [ClawdHub](https://clawdhub.com)

## Support

For issues:
- API problems: Check Vercel logs, file issue in BlackOps repo
- Skill problems: File issue in ClawdHub skills repo
- Usage questions: support@blackopscenter.com
