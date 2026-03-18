#!/usr/bin/env python3

import argparse
import json
import re
import ssl
import urllib.request
from html import unescape
from pathlib import Path
from urllib.parse import urlparse


USER_AGENT = "Mozilla/5.0 (compatible; tech-news-digest/1.0; +https://openai.com)"
MAX_TEXT_CHARS = 5000

POSITIVE_KEYWORDS = {
    "ai",
    "agent",
    "agents",
    "llm",
    "model",
    "models",
    "developer",
    "tool",
    "tools",
    "inference",
    "reasoning",
    "open source",
    "evaluation",
    "benchmark",
    "infrastructure",
    "product",
}

NEGATIVE_KEYWORDS = {
    "sponsored",
    "advertisement",
    "promo",
    "webinar",
    "hiring",
    "job",
    "jobs",
    "sale",
}


def strip_html(raw: str) -> str:
    text = re.sub(r"<script[\s\S]*?</script>", " ", raw, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def fetch_url(url: str, timeout: int) -> tuple[str, str]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout, context=ssl.create_default_context()) as response:
        raw = response.read().decode("utf-8", errors="replace")
        return str(response.geturl()), raw


def extract_title(html_text: str, fallback: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", html_text, flags=re.I | re.S)
    if not match:
        return fallback
    title = strip_html(match.group(1))
    return title or fallback


def extract_summary(html_text: str) -> str:
    text = strip_html(html_text)
    if len(text) > MAX_TEXT_CHARS:
        text = text[:MAX_TEXT_CHARS]
    sentences = re.split(r"(?<=[。.!?])\s+", text)
    summary = " ".join(part.strip() for part in sentences[:3] if part.strip())
    return summary[:600].strip()


def load_catalog(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def iter_sources(catalog: dict, tier_names: list[str]) -> list[dict]:
    rows: list[dict] = []
    sources = catalog.get("sources", {})
    for tier_name in tier_names:
        tier = sources.get(tier_name, {})
        if tier_name == "tier3_browser":
            for item in tier.get("sources", []):
                if item.get("enabled"):
                    rows.append({"tier": tier_name, **item})
            continue
        for _, batch in tier.items():
            if not isinstance(batch, list):
                continue
            for item in batch:
                if item.get("enabled"):
                    rows.append({"tier": tier_name, **item})
    return rows


def score_item(title: str, summary: str, source: dict) -> float:
    haystack = f"{title} {summary}".lower()
    score = float(source.get("avg_quality", 3.5))
    for keyword in POSITIVE_KEYWORDS:
        if keyword in haystack:
            score += 0.25
    for keyword in NEGATIVE_KEYWORDS:
        if keyword in haystack:
            score -= 0.6
    if len(summary) < 80:
        score -= 0.4
    success_rate = float(source.get("success_rate", 0.8))
    score += max(0.0, min(success_rate, 1.0) - 0.8)
    return round(max(0.0, min(score, 5.0)), 2)


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip("/")


def collect(catalog: dict, tier_names: list[str], timeout: int, limit: int) -> dict:
    items: list[dict] = []
    errors: list[dict] = []
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()

    thresholds = catalog.get("quality_thresholds", {})
    min_score = float(thresholds.get("min_score_to_include", 3))
    early_stop = int(thresholds.get("early_stop_threshold", 25))
    sources = iter_sources(catalog, tier_names)

    for source in sources:
        if source.get("fetch_method") == "browser":
            errors.append(
                {
                    "source_id": source["id"],
                    "source_name": source["name"],
                    "error": "browser-only source skipped by script-backed collector",
                }
            )
            continue
        try:
            final_url, raw = fetch_url(source["url"], timeout=timeout)
            title = extract_title(raw, source["name"])
            summary = extract_summary(raw)
            normalized_url = normalize_url(final_url)
            normalized_title = re.sub(r"\s+", " ", title.strip().lower())
            if normalized_url in seen_urls or normalized_title in seen_titles:
                continue
            score = score_item(title, summary, source)
            if score < min_score:
                continue
            item = {
                "source_id": source["id"],
                "source_name": source["name"],
                "tier": source["tier"],
                "title": title,
                "summary": summary,
                "url": final_url,
                "score": score,
                "fetch_method": source["fetch_method"],
            }
            items.append(item)
            seen_urls.add(normalized_url)
            seen_titles.add(normalized_title)
            items.sort(key=lambda row: (-row["score"], row["title"]))
            if limit and len(items) >= limit:
                items = items[:limit]
                break
            if len(items) >= early_stop:
                break
        except Exception as exc:
            errors.append({"source_id": source["id"], "source_name": source["name"], "error": str(exc)})

    return {"items": items, "errors": errors, "tiers": tier_names, "source_count": len(sources)}


def format_markdown(payload: dict) -> str:
    lines = [
        "# Tech News Digest",
        "",
        "## Summary",
        f"- Sources checked: {payload['source_count']}",
        f"- Items included: {len(payload['items'])}",
        f"- Tiers: {', '.join(payload['tiers'])}",
        "",
        "## Top Items",
        "",
    ]
    if not payload["items"]:
        lines.append("- No high-signal items passed the current threshold.")
    for index, item in enumerate(payload["items"], start=1):
        lines.extend(
            [
                f"### {index}. {item['title']}",
                f"- Why it matters: Score {item['score']}/5 based on source quality and keyword relevance.",
                f"- Summary: {item['summary'] or 'Summary unavailable.'}",
                f"- Source: {item['source_name']}",
                f"- Link: {item['url']}",
                "",
            ]
        )
    lines.extend(["## Coverage Notes"])
    if payload["errors"]:
        for err in payload["errors"]:
            lines.append(f"- {err['source_name']}: {err['error']}")
    else:
        lines.append("- No major source failures in this pass.")
    return "\n".join(lines).strip()


def main() -> int:
    skill_dir = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", default=str(skill_dir / "references" / "sources.json"))
    parser.add_argument("--tiers", default="tier1,tier2")
    parser.add_argument("--timeout", type=int, default=15)
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--format", choices=["json", "markdown"], default="json")
    parser.add_argument("--output", default="", help="Optional path to save the rendered output")
    args = parser.parse_args()

    tier_names = [part.strip() for part in args.tiers.split(",") if part.strip()]
    catalog = load_catalog(Path(args.catalog))
    payload = collect(catalog, tier_names, timeout=args.timeout, limit=args.limit)

    rendered = ""
    if args.format == "markdown":
        rendered = format_markdown(payload)
    else:
        rendered = json.dumps(payload, ensure_ascii=False, indent=2)
    print(rendered)

    if args.output:
        output_path = Path(args.output)
        if not output_path.is_absolute():
            output_path = Path.cwd() / output_path
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(rendered + ("\n" if not rendered.endswith("\n") else ""), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
