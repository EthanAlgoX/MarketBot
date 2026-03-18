#!/usr/bin/env python3

import argparse
import concurrent.futures
import datetime as dt
import html
import json
import re
import ssl
import sys
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path


USER_AGENT = "Mozilla/5.0 (compatible; ak-rss-digest/1.0; +https://openai.com)"
ACCEPT = "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8"
DEFAULT_TIMEOUT = 15
DEFAULT_TZ = "Asia/Shanghai"
DEFAULT_DAYS = 7


def local_name(tag):
    return tag.rsplit("}", 1)[-1]


def strip_html(raw):
    if not raw:
        return ""
    text = re.sub(r"<[^>]+>", " ", raw)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def first_text(parent, names):
    for child in parent:
        if local_name(child.tag) in names:
            text = "".join(child.itertext()).strip()
            if text:
                return text
    return ""


def first_link(entry):
    for child in entry:
        if local_name(child.tag) != "link":
            continue
        href = child.attrib.get("href")
        rel = child.attrib.get("rel", "alternate")
        if href and rel == "alternate":
            return href
        text = "".join(child.itertext()).strip()
        if text:
            return text
        if href:
            return href
    return ""


def parse_datetime(raw):
    if not raw:
        return None
    value = raw.strip()
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=dt.timezone.utc)
        return parsed
    except (TypeError, ValueError, IndexError):
        pass

    normalized = value.replace("Z", "+00:00")
    try:
        parsed = dt.datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed


def load_feeds(opml_path):
    root = ET.parse(opml_path).getroot()
    feeds = []
    for outline in root.findall(".//outline[@type='rss']"):
        feeds.append(
            {
                "name": outline.attrib.get("text") or outline.attrib.get("title") or "",
                "xml_url": outline.attrib["xmlUrl"],
                "html_url": outline.attrib.get("htmlUrl", ""),
            }
        )
    return feeds


def fetch_url(url, timeout):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": ACCEPT,
        },
    )
    with urllib.request.urlopen(req, timeout=timeout, context=ssl.create_default_context()) as resp:
        return resp.read(), resp.geturl(), resp.headers.get("Content-Type", "")


def parse_atom(root, feed_meta):
    feed_title = first_text(root, {"title"}) or feed_meta["name"]
    entries = []
    for entry in root:
        if local_name(entry.tag) != "entry":
            continue
        published_raw = first_text(entry, {"published", "updated", "issued", "created"})
        entries.append(
            {
                "feed_name": feed_title,
                "feed_url": feed_meta["xml_url"],
                "site_url": feed_meta["html_url"],
                "title": first_text(entry, {"title"}) or "(untitled)",
                "link": first_link(entry),
                "published_raw": published_raw,
                "published_at": parse_datetime(published_raw),
                "summary": strip_html(first_text(entry, {"summary", "content"})),
            }
        )
    return entries


def parse_rss(root, feed_meta):
    channel = None
    if local_name(root.tag) == "rss":
        for child in root:
            if local_name(child.tag) == "channel":
                channel = child
                break
    elif local_name(root.tag) in {"RDF", "rdf"}:
        channel = root
    else:
        channel = root

    feed_title = first_text(channel, {"title"}) or feed_meta["name"]
    entries = []
    for item in channel.iter():
        if local_name(item.tag) != "item":
            continue
        published_raw = first_text(item, {"pubDate", "published", "date", "updated"})
        entries.append(
            {
                "feed_name": feed_title,
                "feed_url": feed_meta["xml_url"],
                "site_url": feed_meta["html_url"],
                "title": first_text(item, {"title"}) or "(untitled)",
                "link": first_link(item) or first_text(item, {"guid"}),
                "published_raw": published_raw,
                "published_at": parse_datetime(published_raw),
                "summary": strip_html(first_text(item, {"description", "encoded", "content", "summary"})),
            }
        )
    return entries


def parse_feed(content, feed_meta):
    root = ET.fromstring(content)
    tag = local_name(root.tag)
    if tag == "feed":
        return parse_atom(root, feed_meta)
    if tag in {"rss", "RDF", "rdf"}:
        return parse_rss(root, feed_meta)
    raise ValueError(f"Unsupported feed root tag: {root.tag}")


def fetch_feed(feed_meta, timeout):
    try:
        content, final_url, content_type = fetch_url(feed_meta["xml_url"], timeout)
        entries = parse_feed(content, feed_meta)
        return {
            "feed": feed_meta,
            "status": "ok",
            "final_url": final_url,
            "content_type": content_type,
            "entries": entries,
        }
    except Exception as exc:
        return {
            "feed": feed_meta,
            "status": "error",
            "error": f"{type(exc).__name__}: {exc}",
            "entries": [],
        }


def serialize_item(item, target_tz):
    published_at = item["published_at"]
    published_local = published_at.astimezone(target_tz) if published_at else None
    return {
        "feed_name": item["feed_name"],
        "feed_url": item["feed_url"],
        "site_url": item["site_url"],
        "title": item["title"],
        "link": item["link"],
        "published_raw": item["published_raw"],
        "published_at": published_at.isoformat() if published_at else None,
        "published_local": published_local.isoformat() if published_local else None,
        "summary": item["summary"],
    }


def format_markdown(payload):
    target_label = payload.get("target_date")
    if payload.get("days", 1) > 1:
        target_label = f"{payload['target_date']} minus {payload['days'] - 1} day(s)"
    lines = [
        f"# RSS items for {target_label} ({payload['timezone']})",
        "",
        f"- Feeds checked: {payload['feed_count']}",
        f"- Feeds failed: {len(payload['errors'])}",
        f"- Matching items: {len(payload['items'])}",
        "",
    ]
    for item in payload["items"]:
        lines.append(f"## {item['title']}")
        lines.append(f"- Feed: {item['feed_name']}")
        lines.append(f"- Published: {item['published_local'] or item['published_at'] or 'unknown'}")
        lines.append(f"- Link: {item['link']}")
        if item["summary"]:
            lines.append(f"- Summary: {item['summary']}")
        lines.append("")
    if payload["errors"]:
        lines.append("## Errors")
        for err in payload["errors"]:
            lines.append(f"- {err['feed_name']}: {err['error']}")
    return "\n".join(lines).strip()


def build_payload(results, target_date, days, timezone_name):
    try:
        target_tz = dt.ZoneInfo(timezone_name)
    except Exception:
        target_tz = dt.timezone.utc

    window_end = dt.datetime.combine(target_date, dt.time.max, tzinfo=target_tz)
    window_start = window_end - dt.timedelta(days=days) + dt.timedelta(microseconds=1)

    items = []
    errors = []
    for result in results:
        if result["status"] != "ok":
            errors.append({"feed_name": result["feed"]["name"], "error": result["error"]})
            continue
        for entry in result["entries"]:
            published_at = entry["published_at"]
            if published_at is None:
                continue
            published_local = published_at.astimezone(target_tz)
            if window_start <= published_local <= window_end:
                items.append(serialize_item(entry, target_tz))

    items.sort(key=lambda row: row["published_local"] or row["published_at"] or "", reverse=True)
    return {
        "target_date": target_date.isoformat(),
        "days": days,
        "timezone": timezone_name,
        "feed_count": len(results),
        "items": items,
        "errors": errors,
    }


def main():
    skill_dir = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--feeds-file", default=str(skill_dir / "references" / "feeds.opml"))
    parser.add_argument("--date", default=None, help="YYYY-MM-DD in target timezone")
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS)
    parser.add_argument("--timezone", default=DEFAULT_TZ)
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--format", choices=["json", "markdown"], default="json")
    args = parser.parse_args()

    try:
        target_tz = dt.ZoneInfo(args.timezone)
    except Exception:
        print(json.dumps({"error": f"Invalid timezone: {args.timezone}"}))
        return 2

    if args.date:
        target_date = dt.date.fromisoformat(args.date)
    else:
        target_date = dt.datetime.now(target_tz).date()

    feeds = load_feeds(args.feeds_file)
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(12, max(1, len(feeds)))) as pool:
        results = list(pool.map(lambda feed: fetch_feed(feed, args.timeout), feeds))

    payload = build_payload(results, target_date, max(1, args.days), args.timezone)
    if args.limit and args.limit > 0:
        payload["items"] = payload["items"][: args.limit]

    if args.format == "markdown":
        print(format_markdown(payload))
    else:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
