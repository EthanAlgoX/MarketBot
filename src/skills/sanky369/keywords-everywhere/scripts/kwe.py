#!/usr/bin/env python3
"""
Keywords Everywhere CLI
SEO keyword research, competitor analysis, and traffic metrics
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.parse
from pathlib import Path

BASE_URL = "https://api.keywordseverywhere.com/v1"


def get_api_key():
    """Get API key from environment or config."""
    if os.environ.get("KEYWORDS_EVERYWHERE_API_KEY"):
        return os.environ["KEYWORDS_EVERYWHERE_API_KEY"]
    
    # Try clawdbot config locations
    config_paths = [
        Path.home() / ".clawdbot" / "clawdbot.json",
        Path.home() / ".config" / "clawdbot" / "clawdbot.json",
    ]
    
    for config_path in config_paths:
        try:
            with open(config_path) as f:
                config = json.load(f)
                key = config.get("skills", {}).get("entries", {}).get("keywords-everywhere", {}).get("apiKey")
                if key:
                    return key
        except (FileNotFoundError, json.JSONDecodeError, KeyError):
            pass
    
    return None


def api_request(endpoint, data=None):
    """Make API request."""
    api_key = get_api_key()
    if not api_key:
        print("Error: No API key found. Set KEYWORDS_EVERYWHERE_API_KEY or configure in clawdbot config.", file=sys.stderr)
        sys.exit(1)
    
    url = f"{BASE_URL}/{endpoint}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }
    
    if data:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        encoded_data = urllib.parse.urlencode(data, doseq=True).encode()
        req = urllib.request.Request(url, data=encoded_data, headers=headers, method="POST")
    else:
        req = urllib.request.Request(url, headers=headers, method="GET")
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        try:
            error_json = json.loads(error_body)
            print(f"Error: {error_json.get('message', error_json.get('error', str(e)))}", file=sys.stderr)
        except json.JSONDecodeError:
            print(f"Error: {e} - {error_body}", file=sys.stderr)
        sys.exit(1)


def format_table(data, columns):
    """Format data as a table."""
    if not data:
        print("No results found.")
        return
    
    # Calculate column widths
    widths = {}
    for col in columns:
        widths[col["key"]] = len(col["label"])
        for row in data:
            val = col.get("format", lambda x, r: str(x if x is not None else ""))(row.get(col["key"]), row)
            widths[col["key"]] = max(widths[col["key"]], len(str(val)))
    
    # Header
    header = " | ".join(col["label"].ljust(widths[col["key"]]) for col in columns)
    separator = "-+-".join("-" * widths[col["key"]] for col in columns)
    
    print(header)
    print(separator)
    
    # Rows
    for row in data:
        line = " | ".join(
            str(col.get("format", lambda x, r: str(x if x is not None else ""))(row.get(col["key"]), row)).ljust(widths[col["key"]])
            for col in columns
        )
        print(line)


def output(data, fmt, columns=None):
    """Output data in requested format."""
    if fmt == "json":
        print(json.dumps(data, indent=2))
    elif fmt == "csv":
        if isinstance(data, list) and data:
            headers = [c["key"] for c in columns] if columns else list(data[0].keys())
            print(",".join(headers))
            for row in data:
                values = []
                for h in headers:
                    val = row.get(h, "")
                    if isinstance(val, dict):
                        val = json.dumps(val)
                    elif isinstance(val, str) and "," in val:
                        val = f'"{val}"'
                    values.append(str(val) if val is not None else "")
                print(",".join(values))
    else:
        if columns:
            format_table(data, columns)
        else:
            print(json.dumps(data, indent=2))


# Command handlers
def cmd_credits(args):
    """Check credit balance."""
    result = api_request("account/credits")
    print(f"Credit Balance: {result[0]}")


def cmd_countries(args):
    """List supported countries."""
    result = api_request("countries")
    output(result, args.output, [
        {"key": "code", "label": "Code"},
        {"key": "name", "label": "Country"},
    ])


def cmd_currencies(args):
    """List supported currencies."""
    result = api_request("currencies")
    output(result, args.output, [
        {"key": "code", "label": "Code"},
        {"key": "name", "label": "Currency"},
    ])


def cmd_keywords(args):
    """Get keyword data (volume, CPC, competition)."""
    if not args.keywords:
        print("Usage: kwe keywords 'keyword1' 'keyword2' ... [--country us] [--currency usd]", file=sys.stderr)
        sys.exit(1)
    
    data = [("kw[]", kw) for kw in args.keywords]
    data.append(("country", args.country or ""))
    data.append(("currency", args.currency or "usd"))
    data.append(("dataSource", "cli"))
    
    result = api_request("get_keyword_data", data)
    keywords_data = result.get("data", [])
    
    def format_cpc(v, row):
        if isinstance(v, dict):
            return f"{v.get('currency', '$')}{v.get('value', '0.00')}"
        return str(v) if v else "$0.00"
    
    output(keywords_data, args.output, [
        {"key": "keyword", "label": "Keyword"},
        {"key": "vol", "label": "Volume", "format": lambda v, r: str(v or 0)},
        {"key": "cpc", "label": "CPC", "format": format_cpc},
        {"key": "competition", "label": "Competition", "format": lambda v, r: str(v or 0)},
    ])
    
    print(f"\nCredits remaining: {result.get('credits', 'N/A')}")


def cmd_related(args):
    """Find related keywords."""
    if not args.keyword:
        print("Usage: kwe related 'seed keyword' [--num 10]", file=sys.stderr)
        sys.exit(1)
    
    result = api_request("get_related_keywords", {
        "keyword": args.keyword,
        "num": args.num or 10,
    })
    
    keywords = result.get("data", [])
    
    if args.output == "json":
        print(json.dumps({"keywords": keywords, "credits_consumed": result.get("credits_consumed")}, indent=2))
    else:
        print("Related Keywords:")
        for i, kw in enumerate(keywords, 1):
            print(f"{i}. {kw}")
        print(f"\nCredits consumed: {result.get('credits_consumed', 'N/A')}")


def cmd_pasf(args):
    """People Also Search For keywords."""
    if not args.keyword:
        print("Usage: kwe pasf 'seed keyword' [--num 10]", file=sys.stderr)
        sys.exit(1)
    
    result = api_request("get_pasf_keywords", {
        "keyword": args.keyword,
        "num": args.num or 10,
    })
    
    keywords = result.get("data", [])
    
    if args.output == "json":
        print(json.dumps({"keywords": keywords, "credits_consumed": result.get("credits_consumed")}, indent=2))
    else:
        print("People Also Search For:")
        for i, kw in enumerate(keywords, 1):
            print(f"{i}. {kw}")
        print(f"\nCredits consumed: {result.get('credits_consumed', 'N/A')}")


def cmd_domain_keywords(args):
    """Keywords a domain ranks for."""
    if not args.domain:
        print("Usage: kwe domain-keywords example.com [--country us] [--num 10]", file=sys.stderr)
        sys.exit(1)
    
    result = api_request("get_domain_keywords", {
        "domain": args.domain,
        "country": args.country or "",
        "num": args.num or 10,
    })
    
    data = result.get("data", [])
    output(data, args.output, [
        {"key": "keyword", "label": "Keyword"},
        {"key": "estimated_monthly_traffic", "label": "Est. Traffic", "format": lambda v, r: str(v or 0)},
        {"key": "serp_position", "label": "Position", "format": lambda v, r: str(v or "-")},
    ])
    
    print(f"\nCredits consumed: {result.get('credits_consumed', 'N/A')}")


def cmd_url_keywords(args):
    """Keywords a URL ranks for."""
    if not args.url:
        print("Usage: kwe url-keywords 'https://example.com/page' [--country us] [--num 10]", file=sys.stderr)
        sys.exit(1)
    
    result = api_request("get_url_keywords", {
        "url": args.url,
        "country": args.country or "",
        "num": args.num or 10,
    })
    
    data = result.get("data", [])
    output(data, args.output, [
        {"key": "keyword", "label": "Keyword"},
        {"key": "estimated_monthly_traffic", "label": "Est. Traffic", "format": lambda v, r: str(v or 0)},
        {"key": "serp_position", "label": "Position", "format": lambda v, r: str(v or "-")},
    ])
    
    print(f"\nCredits consumed: {result.get('credits_consumed', 'N/A')}")


def cmd_domain_backlinks(args):
    """All backlinks to a domain."""
    if not args.domain:
        print("Usage: kwe domain-backlinks example.com [--num 10]", file=sys.stderr)
        sys.exit(1)
    
    result = api_request("get_domain_backlinks", {
        "domain": args.domain,
        "num": args.num or 10,
    })
    
    data = result.get("data", [])
    output(data, args.output, [
        {"key": "domain_source", "label": "Source Domain"},
        {"key": "anchor_text", "label": "Anchor Text"},
        {"key": "url_target", "label": "Target URL"},
    ])
    
    print(f"\nCredits consumed: {result.get('credits_consumed', 'N/A')}")


def cmd_unique_domain_backlinks(args):
    """Unique referring domains."""
    if not args.domain:
        print("Usage: kwe unique-domain-backlinks example.com [--num 10]", file=sys.stderr)
        sys.exit(1)
    
    result = api_request("get_unique_domain_backlinks", {
        "domain": args.domain,
        "num": args.num or 10,
    })
    
    data = result.get("data", [])
    output(data, args.output, [
        {"key": "domain_source", "label": "Source Domain"},
        {"key": "anchor_text", "label": "Anchor Text"},
        {"key": "url_target", "label": "Target URL"},
    ])
    
    print(f"\nCredits consumed: {result.get('credits_consumed', 'N/A')}")


def cmd_page_backlinks(args):
    """Backlinks to a specific URL."""
    if not args.url:
        print("Usage: kwe page-backlinks 'https://example.com/page' [--num 10]", file=sys.stderr)
        sys.exit(1)
    
    result = api_request("get_page_backlinks", {
        "url": args.url,
        "num": args.num or 10,
    })
    
    data = result.get("data", [])
    output(data, args.output, [
        {"key": "domain_source", "label": "Source Domain"},
        {"key": "anchor_text", "label": "Anchor Text"},
        {"key": "url_source", "label": "Source URL"},
    ])
    
    print(f"\nCredits consumed: {result.get('credits_consumed', 'N/A')}")


def cmd_unique_page_backlinks(args):
    """Unique backlinks to a URL."""
    if not args.url:
        print("Usage: kwe unique-page-backlinks 'https://example.com/page' [--num 10]", file=sys.stderr)
        sys.exit(1)
    
    result = api_request("get_unique_page_backlinks", {
        "url": args.url,
        "num": args.num or 10,
    })
    
    data = result.get("data", [])
    output(data, args.output, [
        {"key": "domain_source", "label": "Source Domain"},
        {"key": "anchor_text", "label": "Anchor Text"},
        {"key": "url_source", "label": "Source URL"},
    ])
    
    print(f"\nCredits consumed: {result.get('credits_consumed', 'N/A')}")


def main():
    parser = argparse.ArgumentParser(
        description="Keywords Everywhere CLI - SEO Keyword Research",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  kwe keywords "seo tools" "keyword research" --country us
  kwe related "content marketing" --num 50
  kwe domain-keywords competitor.com --num 200 --output json
  kwe unique-domain-backlinks competitor.com --num 100

Configuration:
  Set API key via:
    export KEYWORDS_EVERYWHERE_API_KEY="your_key"
  Or in clawdbot config under skills.entries.keywords-everywhere.apiKey
"""
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # credits
    subparsers.add_parser("credits", help="Check credit balance")
    
    # countries
    p = subparsers.add_parser("countries", help="List supported countries")
    p.add_argument("--output", choices=["table", "json", "csv"], default="table")
    
    # currencies
    p = subparsers.add_parser("currencies", help="List supported currencies")
    p.add_argument("--output", choices=["table", "json", "csv"], default="table")
    
    # keywords
    p = subparsers.add_parser("keywords", help="Get volume, CPC, competition for keywords")
    p.add_argument("keywords", nargs="+", help="Keywords to analyze")
    p.add_argument("--country", help="Country code (us, uk, in, etc.)")
    p.add_argument("--currency", default="usd", help="Currency code")
    p.add_argument("--output", choices=["table", "json", "csv"], default="table")
    
    # related
    p = subparsers.add_parser("related", help="Find related keywords")
    p.add_argument("keyword", help="Seed keyword")
    p.add_argument("--num", type=int, default=10, help="Number of results")
    p.add_argument("--output", choices=["table", "json", "csv"], default="table")
    
    # pasf
    p = subparsers.add_parser("pasf", help="People Also Search For keywords")
    p.add_argument("keyword", help="Seed keyword")
    p.add_argument("--num", type=int, default=10, help="Number of results")
    p.add_argument("--output", choices=["table", "json", "csv"], default="table")
    
    # domain-keywords
    p = subparsers.add_parser("domain-keywords", help="Keywords a domain ranks for")
    p.add_argument("domain", help="Domain to analyze")
    p.add_argument("--country", help="Country code")
    p.add_argument("--num", type=int, default=10, help="Number of results")
    p.add_argument("--output", choices=["table", "json", "csv"], default="table")
    
    # url-keywords
    p = subparsers.add_parser("url-keywords", help="Keywords a URL ranks for")
    p.add_argument("url", help="URL to analyze")
    p.add_argument("--country", help="Country code")
    p.add_argument("--num", type=int, default=10, help="Number of results")
    p.add_argument("--output", choices=["table", "json", "csv"], default="table")
    
    # domain-backlinks
    p = subparsers.add_parser("domain-backlinks", help="All backlinks to domain")
    p.add_argument("domain", help="Domain to analyze")
    p.add_argument("--num", type=int, default=10, help="Number of results")
    p.add_argument("--output", choices=["table", "json", "csv"], default="table")
    
    # unique-domain-backlinks
    p = subparsers.add_parser("unique-domain-backlinks", help="Unique referring domains")
    p.add_argument("domain", help="Domain to analyze")
    p.add_argument("--num", type=int, default=10, help="Number of results")
    p.add_argument("--output", choices=["table", "json", "csv"], default="table")
    
    # page-backlinks
    p = subparsers.add_parser("page-backlinks", help="All backlinks to URL")
    p.add_argument("url", help="URL to analyze")
    p.add_argument("--num", type=int, default=10, help="Number of results")
    p.add_argument("--output", choices=["table", "json", "csv"], default="table")
    
    # unique-page-backlinks
    p = subparsers.add_parser("unique-page-backlinks", help="Unique backlinks to URL")
    p.add_argument("url", help="URL to analyze")
    p.add_argument("--num", type=int, default=10, help="Number of results")
    p.add_argument("--output", choices=["table", "json", "csv"], default="table")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(0)
    
    commands = {
        "credits": cmd_credits,
        "countries": cmd_countries,
        "currencies": cmd_currencies,
        "keywords": cmd_keywords,
        "related": cmd_related,
        "pasf": cmd_pasf,
        "domain-keywords": cmd_domain_keywords,
        "url-keywords": cmd_url_keywords,
        "domain-backlinks": cmd_domain_backlinks,
        "unique-domain-backlinks": cmd_unique_domain_backlinks,
        "page-backlinks": cmd_page_backlinks,
        "unique-page-backlinks": cmd_unique_page_backlinks,
    }
    
    if args.command in commands:
        commands[args.command](args)
    else:
        print(f"Unknown command: {args.command}", file=sys.stderr)
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
