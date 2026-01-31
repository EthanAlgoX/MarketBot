## API endpoints

1. Tenant token
   - `POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal`
   - Body JSON: `{ "app_id": "...", "app_secret": "..." }`
2. File download
   - `GET https://open.feishu.cn/open-apis/im/v1/messages/{message_id}/resources/{file_key}?type={type}`
   - Header: `Authorization: Bearer <token>`

## Output contract

Always print a single JSON object to stdout:

```
{
  "ok": true,
  "path": "/root/clawd/uploads/20260129/xxx.pdf",
  "filename": "xxx.pdf",
  "bytes": 12345,
  "sha256": "..."
}
```

On error:

```
{
  "ok": false,
  "error": "human-readable error message"
}
```

## Safety and limits

- Enforce `max_bytes` strictly; delete partial files on any failure.
- Ensure the final path is within `outdir` using realpath checks.
- Never log token or secret values.
