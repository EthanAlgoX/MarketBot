#!/usr/bin/env python3
"""
Simmer Trade Journal Skill

Auto-logs SDK trades with context, tracks outcomes when markets resolve,
and generates calibration reports to improve trading performance.

Uses a hybrid approach:
- Poll /api/sdk/trades for baseline trade data
- Enrich with thesis/confidence when skills call log_trade()

Usage:
    python tradejournal.py                    # Show status
    python tradejournal.py --sync             # Fetch new trades from API
    python tradejournal.py --history 10       # Show last 10 trades
    python tradejournal.py --sync-outcomes    # Update resolved markets
    python tradejournal.py --report weekly    # Generate weekly report
    python tradejournal.py --config           # Show configuration
    python tradejournal.py --export FILE.csv  # Export to CSV
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode


# =============================================================================
# Configuration
# =============================================================================

SIMMER_API_KEY = os.environ.get("SIMMER_API_KEY", "")
SIMMER_API_URL = os.environ.get("SIMMER_API_URL", "https://api.simmer.markets")

# Storage location (relative to script)
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "data"
TRADES_FILE = DATA_DIR / "trades.json"
CONTEXT_FILE = DATA_DIR / "context.json"  # For log_trade() enrichment

# Sync settings
DEFAULT_FETCH_LIMIT = 100
REQUEST_TIMEOUT_SECONDS = 30


# =============================================================================
# Storage
# =============================================================================

def ensure_data_dir():
    """Create data directory if it doesn't exist."""
    DATA_DIR.mkdir(exist_ok=True)


def load_trades() -> Dict[str, Any]:
    """Load trades from local storage."""
    default_data = {
        "trades": [],
        "metadata": {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_sync": None,
            "total_trades": 0
        }
    }

    if not TRADES_FILE.exists():
        return default_data

    try:
        with open(TRADES_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"⚠️  Warning: Could not load {TRADES_FILE}: {e}")
        print("   Starting with empty trade history.")
        return default_data


def save_trades(data: Dict[str, Any]):
    """Save trades to local storage."""
    ensure_data_dir()
    data["metadata"]["total_trades"] = len(data["trades"])

    with open(TRADES_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


def load_context() -> Dict[str, Dict]:
    """Load trade context (thesis, confidence) from local storage."""
    if not CONTEXT_FILE.exists():
        return {}

    try:
        with open(CONTEXT_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"⚠️  Warning: Could not load {CONTEXT_FILE}: {e}")
        return {}


def save_context(data: Dict[str, Dict]):
    """Save trade context to local storage."""
    ensure_data_dir()

    with open(CONTEXT_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


# =============================================================================
# API
# =============================================================================

def api_request(method: str, endpoint: str, params: Dict = None) -> Dict:
    """Make authenticated request to Simmer API."""
    if not SIMMER_API_KEY:
        raise ValueError("SIMMER_API_KEY environment variable not set")

    url = f"{SIMMER_API_URL}{endpoint}"
    if params:
        # Filter None values and URL-encode parameters
        filtered = {k: v for k, v in params.items() if v is not None}
        url = f"{url}?{urlencode(filtered)}"

    headers = {
        "Authorization": f"Bearer {SIMMER_API_KEY}",
        "Content-Type": "application/json",
    }

    req = Request(url, headers=headers, method=method)

    try:
        with urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as e:
        error_body = e.read().decode("utf-8")
        try:
            error_json = json.loads(error_body)
            raise ValueError(f"API error ({e.code}): {error_json.get('detail', error_body)}")
        except json.JSONDecodeError:
            raise ValueError(f"API error ({e.code}): {error_body}")
    except URLError as e:
        raise ValueError(f"Network error: {e.reason}")


def fetch_trades(limit: int = DEFAULT_FETCH_LIMIT, offset: int = 0) -> Dict:
    """Fetch trades from Simmer API."""
    return api_request("GET", "/api/sdk/trades", {
        "limit": limit,
        "offset": offset
    })


def fetch_markets_by_ids(market_ids: List[str]) -> Dict:
    """Fetch market data for specific IDs (for outcome tracking)."""
    if not market_ids:
        return {"markets": []}
    # API accepts comma-separated IDs, max 50
    ids_param = ",".join(market_ids[:50])
    return api_request("GET", "/api/sdk/markets", {
        "ids": ids_param,
        "include_analytics_only": "true"  # Include all markets
    })


# =============================================================================
# Sync Logic
# =============================================================================

def sync_trades(dry_run: bool = False) -> Dict[str, Any]:
    """
    Sync trades from API to local storage.

    Returns dict with sync results.
    """
    print("\n📓 Syncing trades from Simmer API...")

    # Load existing trades
    data = load_trades()
    existing_ids = {t["id"] for t in data["trades"]}

    # Fetch from API
    response = fetch_trades(limit=DEFAULT_FETCH_LIMIT)
    api_trades = response.get("trades", [])
    total_available = response.get("total_count", 0)

    print(f"  API returned {len(api_trades)} trades (total available: {total_available})")

    # Find new trades
    new_trades = []
    for trade in api_trades:
        if trade["id"] not in existing_ids:
            # Add sync metadata
            trade["synced_at"] = datetime.now(timezone.utc).isoformat()
            trade["outcome"] = {
                "resolved": False,
                "winning_side": None,
                "pnl_usd": None,
                "was_correct": None
            }
            new_trades.append(trade)

    print(f"  Found {len(new_trades)} new trades")

    if dry_run:
        print("  [DRY RUN] Would save these trades:")
        for t in new_trades[:5]:
            print(f"    - {t['market_question'][:50]}... ({t['side']} @ ${t['cost']:.2f})")
        if len(new_trades) > 5:
            print(f"    ... and {len(new_trades) - 5} more")
        return {"new_count": len(new_trades), "dry_run": True}

    # Merge and save
    if new_trades:
        data["trades"] = new_trades + data["trades"]  # Newest first
        data["metadata"]["last_sync"] = datetime.now(timezone.utc).isoformat()
        save_trades(data)
        print(f"  ✅ Saved {len(new_trades)} new trades")
    else:
        print("  No new trades to save")

    return {
        "new_count": len(new_trades),
        "total_local": len(data["trades"]),
        "total_api": total_available
    }


def sync_outcomes(dry_run: bool = False) -> Dict[str, Any]:
    """
    Update outcomes for resolved markets.

    Checks market status for all pending trades and updates P&L.
    """
    print("\n📓 Syncing market outcomes...")

    data = load_trades()
    trades = data["trades"]

    # Find trades with pending outcomes
    pending = [t for t in trades if not t.get("outcome", {}).get("resolved")]

    if not pending:
        print("  No pending trades to check")
        return {"updated": 0}

    print(f"  Checking {len(pending)} pending trades...")

    # Get unique market IDs
    market_ids = list(set(t["market_id"] for t in pending))

    # Fetch market data in batches of 50
    markets_by_id = {}
    for i in range(0, len(market_ids), 50):
        batch = market_ids[i:i+50]
        response = fetch_markets_by_ids(batch)
        for m in response.get("markets", []):
            markets_by_id[m["id"]] = m

    print(f"  Fetched data for {len(markets_by_id)} markets")

    # Update outcomes
    updated_count = 0
    for trade in trades:
        if trade.get("outcome", {}).get("resolved"):
            continue  # Already resolved

        market = markets_by_id.get(trade["market_id"])
        if not market:
            continue

        if market.get("status") != "resolved":
            continue  # Still pending

        # Market is resolved - update outcome
        outcome_yes_won = market.get("outcome")  # True = YES won, False = NO won

        if outcome_yes_won is None:
            continue  # No outcome data yet

        trade_side = trade.get("side", "").lower()
        was_correct = (trade_side == "yes" and outcome_yes_won) or \
                      (trade_side == "no" and not outcome_yes_won)

        # Calculate P&L
        shares = trade.get("shares", 0)
        cost = trade.get("cost", 0)

        if was_correct:
            # Won: shares pay out $1 each
            pnl = shares - cost
        else:
            # Lost: shares worth $0
            pnl = -cost

        trade["outcome"] = {
            "resolved": True,
            "winning_side": "yes" if outcome_yes_won else "no",
            "pnl_usd": round(pnl, 2),
            "was_correct": was_correct,
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }

        updated_count += 1

        result_emoji = "✅" if was_correct else "❌"
        print(f"  {result_emoji} {trade['market_question'][:40]}... "
              f"({trade_side.upper()}) → ${pnl:+.2f}")

    if dry_run:
        print(f"  [DRY RUN] Would update {updated_count} trades")
        return {"updated": updated_count, "dry_run": True}

    if updated_count > 0:
        data["metadata"]["last_outcome_sync"] = datetime.now(timezone.utc).isoformat()
        save_trades(data)
        print(f"  ✅ Updated {updated_count} trade outcomes")
    else:
        print("  No new outcomes to update")

    return {"updated": updated_count}


# =============================================================================
# Display
# =============================================================================

def show_history(n: int = 10):
    """Show recent trade history."""
    data = load_trades()
    context = load_context()
    trades = data["trades"][:n]

    if not trades:
        print("\n📓 No trades recorded yet.")
        print("   Run: python tradejournal.py --sync")
        return

    print(f"\n📓 Recent Trades ({len(trades)} of {len(data['trades'])})")
    print("=" * 70)

    for i, t in enumerate(trades, 1):
        # Basic info
        side = t.get("side", "unknown")
        side_emoji = "🟢" if side == "yes" else "🔴"
        question = t.get("market_question", "Unknown market")[:45]
        cost = t.get("cost", 0)
        shares = t.get("shares", 0)
        created = t.get("created_at", "")[:10]

        # Outcome
        outcome = t.get("outcome", {})
        if outcome.get("resolved"):
            result = "✅ Won" if outcome.get("was_correct") else "❌ Lost"
            pnl = outcome.get("pnl_usd", 0)
            pnl_str = f" (${pnl:+.2f})" if pnl else ""
        else:
            result = "⏳ Pending"
            pnl_str = ""

        # Context (if enriched)
        ctx = context.get(t["id"], {})
        source = ctx.get("source", "")
        source_str = f" [{source}]" if source else ""

        print(f"{i}. {side_emoji} {question}...")
        print(f"   {shares:.1f} shares @ ${cost:.2f} | {created} | {result}{pnl_str}{source_str}")
        print()


def show_status():
    """Show current journal status."""
    data = load_trades()
    metadata = data.get("metadata", {})
    trades = data.get("trades", [])

    # Count outcomes
    resolved = [t for t in trades if t.get("outcome", {}).get("resolved")]
    pending = len(trades) - len(resolved)
    wins = len([t for t in resolved if t.get("outcome", {}).get("was_correct")])
    losses = len(resolved) - wins

    print("\n📓 Trade Journal Status")
    print("=" * 40)
    print(f"Total trades: {len(trades)}")
    print(f"  Resolved: {len(resolved)} ({wins} wins, {losses} losses)")
    print(f"  Pending:  {pending}")

    if resolved:
        win_rate = wins / len(resolved) * 100
        print(f"  Win rate: {win_rate:.1f}%")

    print(f"\nLast sync: {metadata.get('last_sync', 'Never')}")
    print(f"Storage:   {TRADES_FILE}")


def show_config():
    """Show current configuration."""
    print("\n📓 Trade Journal Configuration")
    print("=" * 40)
    print(f"API Key:  {'✅ Set' if SIMMER_API_KEY else '❌ Not set'}")
    print(f"API URL:  {SIMMER_API_URL}")
    print(f"Data dir: {DATA_DIR}")
    print(f"Trades:   {TRADES_FILE}")


# =============================================================================
# Reports
# =============================================================================

def generate_report(period: str = "weekly"):
    """Generate a summary report."""
    data = load_trades()
    trades = data.get("trades", [])

    if not trades:
        print("\n📓 No trades to report on.")
        return

    # Filter by period
    now = datetime.now(timezone.utc)
    if period == "daily":
        cutoff_days = 1
    elif period == "weekly":
        cutoff_days = 7
    elif period == "monthly":
        cutoff_days = 30
    else:
        cutoff_days = 7

    period_trades = []
    for t in trades:
        created = t.get("created_at", "")
        if created:
            try:
                trade_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                if (now - trade_dt).days <= cutoff_days:
                    period_trades.append(t)
            except ValueError:
                continue

    print(f"\n📓 {period.capitalize()} Report")
    print("=" * 40)
    print(f"Period: Last {cutoff_days} days")
    print(f"Trades: {len(period_trades)}")

    if not period_trades:
        print("No trades in this period.")
        return

    # Calculate stats
    total_cost = sum(t.get("cost", 0) for t in period_trades)
    resolved = [t for t in period_trades if t.get("outcome", {}).get("resolved")]
    wins = len([t for t in resolved if t.get("outcome", {}).get("was_correct")])

    print(f"Total cost: ${total_cost:.2f}")
    print(f"Resolved: {len(resolved)} / {len(period_trades)}")

    if resolved:
        win_rate = wins / len(resolved) * 100
        total_pnl = sum(t.get("outcome", {}).get("pnl_usd", 0) for t in resolved)
        print(f"Win rate: {win_rate:.1f}%")
        print(f"P&L: ${total_pnl:+.2f}")

    # By side
    yes_trades = [t for t in period_trades if t.get("side") == "yes"]
    no_trades = [t for t in period_trades if t.get("side") == "no"]
    print(f"\nBy side: {len(yes_trades)} YES, {len(no_trades)} NO")


def export_csv(filename: str):
    """Export trades to CSV."""
    import csv

    data = load_trades()
    trades = data.get("trades", [])

    if not trades:
        print("No trades to export.")
        return

    fieldnames = [
        "id", "created_at", "market_id", "market_question", "side",
        "shares", "cost", "price_before", "price_after",
        "resolved", "winning_side", "pnl_usd", "was_correct"
    ]

    with open(filename, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()

        for t in trades:
            row = {**t}
            outcome = t.get("outcome", {})
            row["resolved"] = outcome.get("resolved", False)
            row["winning_side"] = outcome.get("winning_side")
            row["pnl_usd"] = outcome.get("pnl_usd")
            row["was_correct"] = outcome.get("was_correct")
            writer.writerow(row)

    print(f"✅ Exported {len(trades)} trades to {filename}")


# =============================================================================
# Context Enrichment (for skill integration)
# =============================================================================

def log_trade(
    trade_id: str,
    source: str,
    thesis: str = None,
    confidence: float = None,
    **extra
):
    """
    Log additional context for a trade.

    Called by other skills after executing a trade to add:
    - source: which skill made the trade (copytrading, weather, etc.)
    - thesis: reasoning for the trade
    - confidence: 0.0-1.0 confidence level

    Usage from other skills:
        from tradejournal import log_trade
        log_trade(
            trade_id=result['trade_id'],
            source="copytrading",
            thesis="Mirroring whale 0x123...",
            confidence=0.70
        )
    """
    context = load_context()

    context[trade_id] = {
        "source": source,
        "thesis": thesis,
        "confidence": confidence,
        "logged_at": datetime.now(timezone.utc).isoformat(),
        **extra
    }

    save_context(context)
    print(f"📓 Logged context for trade {trade_id[:8]}... (source: {source})")


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Simmer Trade Journal - Track and analyze your trades"
    )

    parser.add_argument("--sync", action="store_true",
                        help="Sync trades from Simmer API")
    parser.add_argument("--history", type=int, nargs="?", const=10, metavar="N",
                        help="Show last N trades (default: 10)")
    parser.add_argument("--sync-outcomes", action="store_true",
                        help="Update outcomes for resolved markets")
    parser.add_argument("--report", choices=["daily", "weekly", "monthly"],
                        help="Generate summary report")
    parser.add_argument("--config", action="store_true",
                        help="Show configuration")
    parser.add_argument("--export", metavar="FILE",
                        help="Export trades to CSV")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would happen without making changes")

    args = parser.parse_args()

    # Handle commands
    if args.config:
        show_config()
    elif args.sync:
        sync_trades(dry_run=args.dry_run)
    elif args.history is not None:
        show_history(args.history)
    elif args.sync_outcomes:
        sync_outcomes(dry_run=args.dry_run)
    elif args.report:
        generate_report(args.report)
    elif args.export:
        export_csv(args.export)
    else:
        # Default: show status
        show_status()


if __name__ == "__main__":
    main()
