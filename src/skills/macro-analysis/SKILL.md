---
name: macro-analysis
description: Framework for top-down market regime, rates, and economic cycles.
metadata:
  marketbot:
    emoji: "🌍"
    skillKey: "macro-analysis"
    invocation:
      userInvocable: true
    commands:
      - name: "macro_check"
        description: "Check macro economic conditions"
        dispatch:
          kind: "tool"
          toolName: "market_fetch"
          argMode: "raw"
---

# Macro Analysis Expert Guide

Use this skill to determine the broad market environment ("The Tide"). Don't fight the Fed.

## 🌡️ The Macro Dashboard

### 1. Liquidity (The Fuel)

- **US 10Y Yield (US10Y)**:
  - Rising aggressively → Bad for Tech/Crypto (Risk Off).
  - Falling/Stable → Good for Risk Assets (Risk On).
- **DXY (Dollar Index)**:
  - Strong Dollar (>105) → Headwind for stocks/crypto.
  - Weak Dollar (<100) → Tailwind.

### 2. The Fed (The Driver)

- **FOMC Rate Decisions**: Hike? Pause? Cut?
  - **Hikes**: Tightening liquidity (Bearish).
  - **Cuts**: Adding liquidity (Bullish, usually).
- **Inflation (CPI/PCE)**:
  - High (>3%) → Fed stays hawkish.
  - Low (<2%) → Fed can cut.

### 3. Economic Health (The Engine)

- **Unemployment**:
  - Low (<4%) → Strong economy (but Fed may hike).
  - Rising fast → Recession fear.
- **GDP**: Positive = Expansion. Negative = Contraction.

### 4. Fear Gauge

- **VIX**: Volatility Index.
  - < 15: Complacency (Bullish trends).
  - > 20: Fear (Choppy).
  - > 30: Panic (Capitulation/Crash).

## 🧭 Regime Framework

| Regime | Condition | Asset Strategy |
|--------|-----------|----------------|
| **Goldilocks** | Growth Up, Inflation Down | **Strong Buy** (Tech, Crypto, Growth) |
| **Reflation** | Growth Up, Inflation Up | **Buy** (Commodities, Energy, Value) |
| **Stagflation** | Growth Down, Inflation Up | **Defensive** (Cash, Gold, Staples) |
| **Recession** | Growth Down, Inflation Down | **Caution** (Bonds, Quality, then Cash) |

## 📝 Execution Checklist

1. **Check Rates**: Where is the 10Y and DXY?
2. **Check Calendar**: Any big events this week (CPI, FOMC)?
3. **Identify Regime**: Are we Risk-On or Risk-Off?
4. **Adjust Exposure**:
    - **Risk-On**: Focus on High Beta (Tech/Crypto).
    - **Risk-Off**: Focus on Dollar/Cash/Defensive.
