#!/usr/bin/env python3
"""Blinko API helper for OpenClaw.

Uses env:
- BLINKO_API_KEY (required)
- BLINKO_BASE_URL (optional, default: https://blinko.exemple.com)

Examples:
  ./blinko.py list --page 1 --size 20
  ./blinko.py create --title "Test" --content "Hello" --tags "#Inbox #Todo/à-faire"
  ./blinko.py delete --ids 123 124
  ./blinko.py tags
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

DEFAULT_BASE_URL = "https://blinko.exemple.com"


def _get_env(name: str, default: Optional[str] = None) -> str:
    val = os.environ.get(name)
    if val is None or val == "":
        if default is None:
            raise SystemExit(f"Missing env var: {name}")
        return default
    return val


def _http_json(method: str, url: str, payload: Optional[Dict[str, Any]] = None) -> Any:
    req = urllib.request.Request(url, method=method.upper())
    # Cloudflare on blinko.infodeal.fr may block requests without a browser-like UA (error 1010).
    req.add_header("User-Agent", "Mozilla/5.0 (OpenClaw; Blinko helper)")
    token = _get_env("BLINKO_API_KEY")
    req.add_header("Authorization", f"Bearer {token}")
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        req.add_header("Content-Type", "application/json")
        req.data = body

    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            if not raw:
                return None
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "ignore")
        raise SystemExit(f"HTTP {e.code} {method} {url}: {raw[:2000]}")


def _api_url(path: str) -> str:
    base = _get_env("BLINKO_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    return f"{base}/api{path}" if not path.startswith("/api") else f"{base}{path}"


def cmd_list(args: argparse.Namespace) -> None:
    data = {
        "page": args.page,
        "size": args.size,
        "orderBy": args.order_by,
        "type": args.type,
        "tagId": None if args.tag_id is None else args.tag_id,
        "isArchived": bool(args.archived),
        "searchText": args.search or "",
    }
    items = _http_json("POST", _api_url("/v1/note/list"), data)
    if not isinstance(items, list):
        print(json.dumps(items, ensure_ascii=False, indent=2))
        return
    for n in items:
        nid = n.get("id")
        first = (n.get("content") or "").strip().split("\n", 1)[0]
        print(f"{nid}\t{first}")


def cmd_create(args: argparse.Namespace) -> None:
    # Basic Markdown: optional title as H1.
    content = args.content
    if args.title:
        content = f"# {args.title}\n\n{content}" if content else f"# {args.title}\n"
    if args.tags:
        content = content.rstrip() + "\n\n" + args.tags.strip() + "\n"

    out = _http_json("POST", _api_url("/v1/note/upsert"), {"content": content, "type": args.type})
    print(json.dumps(out, ensure_ascii=False, indent=2))


def cmd_delete(args: argparse.Namespace) -> None:
    if not args.yes:
        raise SystemExit("Refusing to delete without --yes")
    out = _http_json("POST", _api_url("/v1/note/batch-delete"), {"ids": args.ids})
    print(json.dumps(out, ensure_ascii=False, indent=2))


def cmd_tags(args: argparse.Namespace) -> None:
    tags = _http_json("GET", _api_url("/v1/tags/list"))
    print(json.dumps(tags, ensure_ascii=False, indent=2))


def cmd_delete_tag(args: argparse.Namespace) -> None:
    if not args.yes:
        raise SystemExit("Refusing to delete tag without --yes")
    out = _http_json("POST", _api_url("/v1/tags/delete-only-tag"), {"id": args.id})
    print(json.dumps(out, ensure_ascii=False, indent=2))


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="blinko", description="Blinko API helper")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("list", help="List notes")
    sp.add_argument("--page", type=int, default=1)
    sp.add_argument("--size", type=int, default=30)
    sp.add_argument("--order-by", choices=["asc", "desc"], default="desc")
    sp.add_argument("--type", type=int, default=-1, help="0/1/2 or -1 for all")
    sp.add_argument("--tag-id", type=int)
    sp.add_argument("--archived", action="store_true")
    sp.add_argument("--search", type=str, default="")
    sp.set_defaults(func=cmd_list)

    sp = sub.add_parser("create", help="Create a note")
    sp.add_argument("--title", type=str, default="")
    sp.add_argument("--content", type=str, required=True)
    sp.add_argument("--tags", type=str, default="")
    sp.add_argument("--type", type=int, default=0)
    sp.set_defaults(func=cmd_create)

    sp = sub.add_parser("delete", help="Delete notes by ids")
    sp.add_argument("--yes", action="store_true")
    sp.add_argument("ids", nargs="+", type=int)
    sp.set_defaults(func=cmd_delete)

    sp = sub.add_parser("tags", help="List tags")
    sp.set_defaults(func=cmd_tags)

    sp = sub.add_parser("delete-tag", help="Delete a tag (name only)")
    sp.add_argument("--yes", action="store_true")
    sp.add_argument("id", type=int)
    sp.set_defaults(func=cmd_delete_tag)

    return p


def main(argv: List[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
