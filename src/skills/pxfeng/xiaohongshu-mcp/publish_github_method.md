# Publishing to ClawdHub - GitHub Method

## Step 1: Locate the Repository
The Xiaohongshu skill was originally downloaded from ClawdHub as indicated by the .clawhub/origin.json file. You can:

1. Visit https://clawhub.ai to find the original repository
2. Or check the slug "xiaohongshu-mcp" to locate the repository

## Step 2: Fork and Clone
1. Fork the original repository on GitHub
2. Clone your forked repository:
   ```
   git clone https://github.com/YOUR_USERNAME/clawdhub-skill-xiaohongshu-mcp.git
   ```

## Step 3: Apply Your Changes
1. Copy your updated files to the cloned repository:
   - src/xiaohongshu.ts (with your improvements)
   - README.md (updated version)
   - SKILL.md (updated version)
   - package.json (version updated to 1.1.0)
   - Any other relevant files

2. Make sure to preserve the original file structure

## Step 4: Commit and Push
1. Add your changes:
   ```
   git add .
   git commit -m "feat: Add title validation and improve draft saving reliability"
   ```
2. Push to your fork:
   ```
   git push origin main
   ```

## Step 5: Create Pull Request
1. Go to the original repository on GitHub
2. Create a pull request from your fork
3. Describe the improvements you've made

## Alternative: Contact Maintainers
If the repository doesn't accept direct pull requests, you may need to:
1. Contact the skill maintainers through ClawdHub
2. Submit your improvements through their preferred process
3. Share your optimized files with them directly

## Files to Include in Your Submission
- Updated src/xiaohongshu.ts with all improvements
- Updated README.md
- Updated SKILL.md
- Updated package.json (version 1.1.0)
- Include the update_summary.md file for documentation