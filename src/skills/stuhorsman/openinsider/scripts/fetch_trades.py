#!/usr/bin/env python3
import sys
import requests
import argparse
import pandas as pd
from io import StringIO

# OpenInsider URL pattern
BASE_URL = "http://openinsider.com/screener"

def fetch_insider_trades(ticker, limit=20):
    # Construct params to mimic a search on OpenInsider
    params = {
        "s": ticker,
        "o": "",
        "pl": "",
        "ph": "",
        "ll": "",
        "lh": "",
        "fd": -1,
        "fdr": "",
        "td": 0,
        "tdr": "",
        "fdlyl": "",
        "fdlyh": "",
        "daysago": "",
        "xp": 1,
        "xs": 1,
        "vl": "",
        "vh": "",
        "ocl": "",
        "och": "",
        "sic1": -1,
        "sicl": 100,
        "sich": 9999,
        "grp": 0,
        "nfl": "",
        "nfh": "",
        "nil": "",
        "nih": "",
        "nol": "",
        "noh": "",
        "v2l": "",
        "v2h": "",
        "oc2l": "",
        "oc2h": "",
        "sortcol": 0,
        "cnt": limit,
        "page": 1
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    try:
        response = requests.get(BASE_URL, params=params, headers=headers)
        response.raise_for_status()
        
        # Parse HTML table with pandas
        dfs = pd.read_html(StringIO(response.text))
        
        if not dfs:
            print("[]")
            return

        # The main table is usually the 12th one (index 11) or the largest one
        # OpenInsider layout is tricky, usually it's the table with 'Filing Date'
        target_df = None
        for df in dfs:
            if "Filing Date" in df.columns and "Ticker" in df.columns:
                target_df = df
                break
        
        if target_df is None:
            print("[]")
            return

        # Clean up
        # Rename cols to be JSON friendly
        target_df = target_df.rename(columns={
            "Filing Date": "filing_date",
            "Trade Date": "trade_date",
            "Ticker": "ticker",
            "Insider Name": "insider_name",
            "Title": "title",
            "Trade Type": "trade_type",
            "Price": "price",
            "Qty": "qty",
            "Owned": "owned",
            "ΔOwn": "delta_own",
            "Value": "value"
        })
        
        # Select relevant cols
        cols = ["filing_date", "trade_date", "ticker", "insider_name", "title", "trade_type", "price", "qty", "value"]
        target_df = target_df[cols]
        
        # Output JSON
        print(target_df.head(limit).to_json(orient="records", date_format="iso"))

    except Exception as e:
        print(f"Error fetching data: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Fetch insider trades from OpenInsider")
    parser.add_argument("ticker", help="Stock ticker symbol (e.g. AAPL)")
    parser.add_argument("--limit", type=int, default=10, help="Max results")
    
    args = parser.parse_args()
    fetch_insider_trades(args.ticker, args.limit)

if __name__ == "__main__":
    main()
