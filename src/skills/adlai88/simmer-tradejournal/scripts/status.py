#!/usr/bin/env python3
"""Quick status check for Trade Journal."""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from tradejournal import show_status, show_history

if __name__ == "__main__":
    show_status()
    print()
    show_history(5)
