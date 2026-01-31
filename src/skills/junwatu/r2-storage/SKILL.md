---
name: r2
description: Cloudflare R2 Storage management — setup, upload, download, sync via rclone
metadata: {"clawdbot":{"emoji":"☁️","requires":{"bins":["rclone"]},"env":["R2_CONFIG"],"install":[{"id":"rclone","kind":"shell","command":"curl -fsSL https://rclone.org/install.sh | sudo bash","label":"Install rclone"}]}}
---

# r2 ☁️

Cloudflare R2 Storage management using rclone.

## Install

```bash
curl -fsSL https://rclone.org/install.sh | sudo bash
```

## Credentials Required

Set `R2_CONFIG` in dashboard with this JSON format:

```json
{
  "access_key_id": "YOUR_ACCESS_KEY_ID",
  "secret_access_key": "YOUR_SECRET_ACCESS_KEY",
  "endpoint": "https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com",
  "bucket": "your-bucket-name"
}
```

**Get credentials from Cloudflare:**
1. Go to https://dash.cloudflare.com → R2
2. Create API token with Object Read/Write/List permissions
3. Copy Account ID (from R2 dashboard URL)
4. Endpoint format: `https://<account_id>.r2.cloudflarestorage.com`

## Setup

```bash
# Quick setup
r2-setup --config '{"access_key_id":"...","secret_access_key":"...","endpoint":"...","bucket":"..."}'
```

Or run interactively:
```bash
./skills/r2/scripts/setup.sh
```

## Commands

### Upload

```bash
r2-upload /path/to/file.txt              # Upload single file
r2-upload /path/to/folder/               # Upload folder contents
r2-upload /path/to/file.txt --bucket other-bucket  # Upload to specific bucket
```

### Download

```bash
r2-download file.txt /local/path/        # Download single file
r2-download folder/ /local/              # Download folder
r2-download file.txt                     # Download to current dir
```

### List

```bash
r2-ls                                    # List bucket contents
r2-ls my-bucket                          # List specific bucket
r2-ls --long                             # Long format with sizes
```

### Sync (One-way)

```bash
r2-sync /local/folder/ r2:bucket/        # Local → R2
r2-sync r2:bucket/ /local/folder/        # R2 → Local
r2-sync /local/ r2:bucket/ --delete      # Mirror (delete extra files on dest)
```

### Delete

```bash
r2-rm file.txt                           # Delete single file
r2-rm folder/                            # Delete folder contents
r2-purge my-bucket                       # Delete all files in bucket
```

## Show Credentials

```bash
./skills/r2/scripts/show-creds.sh           # Human-readable
./skills/r2/scripts/show-creds.sh --raw     # JSON format for UI
```

## Direct rclone Commands

```bash
# Copy files
rclone copy /local/file.txt r2:bucket/

# Sync with progress
rclone sync /local/ r2:bucket/ -P

# Check disk usage
rclone size r2:bucket
```

## Config Location

- **Env config**: `~/.config/r2/config.json` (or dashboard `R2_CONFIG`)
- **rclone config**: `~/.config/rclone/rclone.conf`
- **Named remote**: `r2`

## Troubleshooting

### 403 Access Denied
Token lacks permissions. Update API token in Cloudflare with:
- Object Read ✅
- Object Write ✅
- Object List ✅

### Bucket Not Found
Create the bucket first:
```bash
rclone mkdir r2:bucket-name
```
