#!/usr/bin/env python3
import datetime
import hashlib
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
RESOURCE_URL_TMPL = (
    "https://open.feishu.cn/open-apis/im/v1/messages/{message_id}/resources/{file_key}"
)

_token_cache = {
    "token": None,
    "expires_at": 0,
}


def _now_ts() -> int:
    return int(time.time())


def _read_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"missing env: {name}")
    return value


def _fetch_token() -> str:
    app_id = _read_env("FEISHU_APP_ID")
    app_secret = _read_env("FEISHU_APP_SECRET")

    payload = json.dumps({"app_id": app_id, "app_secret": app_secret}).encode("utf-8")
    req = urllib.request.Request(
        TOKEN_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read()

    data = json.loads(body.decode("utf-8"))
    if data.get("code") != 0 or "tenant_access_token" not in data:
        raise RuntimeError(f"token fetch failed: {data.get('msg', 'unknown error')}")

    token = data["tenant_access_token"]
    expires_in = int(data.get("expire", 0) or 0)
    if expires_in <= 0:
        raise RuntimeError("token fetch failed: invalid expire")

    _token_cache["token"] = token
    _token_cache["expires_at"] = _now_ts() + expires_in
    return token


def get_token() -> str:
    token = _token_cache.get("token")
    expires_at = int(_token_cache.get("expires_at") or 0)
    # Refresh 2 minutes before expiry
    if token and _now_ts() < (expires_at - 120):
        return token
    return _fetch_token()


def _parse_content_disposition(cd: str) -> str | None:
    if not cd:
        return None
    parts = cd.split(";")
    params = {}
    for part in parts[1:]:
        if "=" not in part:
            continue
        key, value = part.split("=", 1)
        key = key.strip().lower()
        value = value.strip()
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        params[key] = value

    if "filename*" in params:
        v = params["filename*"]
        if "''" in v:
            _, _, rest = v.partition("''")
            return urllib.parse.unquote(rest)
        return urllib.parse.unquote(v)
    if "filename" in params:
        return params["filename"]
    return None


def _safe_filename(name: str) -> str:
    name = os.path.basename(name.strip())
    return name or "file.bin"


def _ensure_within_outdir(outdir: str, path: str) -> None:
    outdir_real = os.path.realpath(outdir)
    path_real = os.path.realpath(path)
    if os.path.commonpath([outdir_real, path_real]) != outdir_real:
        raise RuntimeError("path traversal detected")


def _unique_path(path: str) -> str:
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(path)
    idx = 1
    while True:
        candidate = f"{base}-{idx}{ext}"
        if not os.path.exists(candidate):
            return candidate
        idx += 1


def fetch_file(message_id: str, file_key: str, file_type: str, outdir: str, max_bytes: int) -> dict:
    token = get_token()
    url = RESOURCE_URL_TMPL.format(message_id=message_id, file_key=file_key)
    url = f"{url}?type={urllib.parse.quote(file_type)}"

    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )

    day_dir = os.path.join(outdir, datetime.datetime.utcnow().strftime("%Y%m%d"))
    os.makedirs(day_dir, exist_ok=True)

    tmp_file = None
    bytes_read = 0
    sha256 = hashlib.sha256()

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            length = resp.headers.get("Content-Length")
            if length is not None and int(length) > max_bytes:
                raise RuntimeError("file exceeds max_bytes")

            cd = resp.headers.get("Content-Disposition", "")
            filename = _parse_content_disposition(cd) or f"{file_key}.bin"
            filename = _safe_filename(filename)

            final_path = _unique_path(os.path.join(day_dir, filename))
            _ensure_within_outdir(outdir, final_path)

            fd, tmp_path = tempfile.mkstemp(prefix=".tmp-", dir=day_dir)
            tmp_file = (fd, tmp_path)

            with os.fdopen(fd, "wb") as f:
                while True:
                    chunk = resp.read(1024 * 1024)
                    if not chunk:
                        break
                    bytes_read += len(chunk)
                    if bytes_read > max_bytes:
                        raise RuntimeError("file exceeds max_bytes")
                    sha256.update(chunk)
                    f.write(chunk)

        os.replace(tmp_path, final_path)
        return {
            "ok": True,
            "path": final_path,
            "filename": os.path.basename(final_path),
            "bytes": bytes_read,
            "sha256": sha256.hexdigest(),
        }
    except Exception as exc:
        if tmp_file:
            _, tmp_path = tmp_file
            try:
                os.remove(tmp_path)
            except OSError:
                pass
        return {
            "ok": False,
            "error": str(exc),
        }


def main() -> int:
    try:
        raw = sys.stdin.read().strip()
        if not raw:
            raise RuntimeError("empty input")
        data = json.loads(raw)
        message_id = data.get("message_id")
        file_key = data.get("file_key")
        if not message_id or not file_key:
            raise RuntimeError("missing message_id or file_key")

        file_type = data.get("type", "file")
        outdir = data.get("outdir", "/root/clawd/uploads")
        max_bytes = int(data.get("max_bytes", 104857600))

        result = fetch_file(
            message_id=message_id,
            file_key=file_key,
            file_type=file_type,
            outdir=outdir,
            max_bytes=max_bytes,
        )
        sys.stdout.write(json.dumps(result, ensure_ascii=True))
        return 0 if result.get("ok") else 1
    except Exception as exc:
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=True))
        return 1


if __name__ == "__main__":
    sys.exit(main())
