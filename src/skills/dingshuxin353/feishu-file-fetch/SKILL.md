---
name: feishu_file_fetch
description: Implements a Clawdbot extension tool that downloads Feishu files by message_id and file_key, streams to disk with sha256, size limits, and path traversal protection. Use when the user asks to build or update the feishu_file_fetch tool, Feishu file download workflow, or Clawdbot extension handling message_id/file_key inputs.
---

# feishu_file_fetch

## Quick start

Create or update the reference implementation at `scripts/feishu_file_fetch.py`. It should:

1. Accept JSON input: `{ message_id, file_key, type="file", outdir="/root/clawd/uploads", max_bytes=104857600 }`
2. Output JSON: `{ ok, path, filename, bytes, sha256, error? }`
3. Use `FEISHU_APP_ID` / `FEISHU_APP_SECRET` to fetch and cache `tenant_access_token` (refresh 2 minutes before expiry).
4. Download via `GET https://open.feishu.cn/open-apis/im/v1/messages/{message_id}/resources/{file_key}?type={type}` with `Authorization: Bearer <token>`.
5. Stream to `outdir/yyyyMMdd/`, parse filename from `Content-Disposition`, fallback to `file_key.bin`.
6. Compute sha256 while streaming; enforce `max_bytes` strictly (terminate and delete temp file if exceeded).
7. Prevent path traversal by ensuring final path stays within `outdir`.
8. Never log tokens or secrets.

## Runtime notes

- Use only stdlib to avoid dependency installs.
- If `Content-Length` exceeds `max_bytes`, fail early.
- Use a temp file in the target directory and `os.replace` on success.

## Example usage

```
echo '{"message_id":"om_xxx","file_key":"file_xxx"}' | python scripts/feishu_file_fetch.py
```

## Additional resources

- For API details and error handling notes, see [reference.md](reference.md)
