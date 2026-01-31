---
name: fundamental-analysis
description: Guide for evaluating company health, valuation, and growth metrics.
metadata:
  marketbot:
    emoji: "🏢"
    skillKey: "fundamental-analysis"
    invocation:
      userInvocable: true
    commands:
      - name: "evaluate"
        description: "Evaluate company fundamentals"
        dispatch:
          kind: "tool"
          toolName: "market_fetch"
          argMode: "raw"
---

# Fundamental Analysis Expert Guide

Use this skill to assess the intrinsic value and health of an asset (Stocks/Crypto). Use `web_search` or `web_fetch` to gather latest reports.

## 🔎 Key Metrics to Check

### 1. Valuation (Is it cheap?)

- **P/E Ratio (Price-to-Earnings)**: Compare vs Sector Avg.
  - High (>30): Expect high growth.
  - Low (<15): Value or dying business?
- **P/S Ratio (Price-to-Sales)**: Good for unprofitable growth stocks.
- **PEG Ratio**: P/E divided by Growth rate. < 1.0 is undervalued.

### 2. Growth (Is it growing?)

- **Revenue Growth**: YoY % change. accelerating or decelerating?
- **EPS Growth**: Earnings Per Share growth.
- **User/Volume Growth**: (For Crypto/Tech) Active addresses, DAU.

### 3. Financial Health (Will it go bankrupt?)

- **Debt-to-Equity**: > 2.0 is risky.
- **Free Cash Flow (FCF)**: Cash left after bills. Positive = Healthy.
- **Current Ratio**: Current Assets / Current Liabilities. > 1.5 is safe.

## 🧠 Qualitative Analysis (The "Moat")

### Business Model

- **Competitive Advantage**: Brand? Network Effect (e.g., Meta)? Cost leader?
- **Management**: Founder-led? Track record of execution?
- **Risks**: Regulatory? Disruptive tech?

## 🚀 Crypto Specifics (Tokenomics)

- **Supply**: Finite (BTC)? Inflationary (DOGE)?
- **FDV vs Market Cap**: High FDV + Low Float = VC Dump risk.
- **Utility**: Does the token capture value (fees/burn)?

## 📝 Analysis Workflow

1. **Gather Data**: Fetch latest earnings, ratios, and news.
2. **Compare**: Benchmark against peers (e.g., Google vs Microsoft).
3. **Rate**:
    - **Buy**: Undervalued + Strong Growth + Wide Moat.
    - **Hold**: Fair Value + Steady.
    - **Sell**: Overvalued + Declining Growth + Broken Thesis.
