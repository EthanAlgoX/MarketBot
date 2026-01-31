---
name: technical-analysis
description: Expert guide for technical indicators, chart patterns, and trading setups.
metadata:
  marketbot:
    emoji: "📈"
    skillKey: "technical-analysis"
    invocation:
      userInvocable: true
    commands:
      - name: "analyze"
        description: "Analyze technical structure"
        dispatch:
          kind: "tool"
          toolName: "market_fetch"
          argMode: "raw"
---

# Technical Analysis Expert Guide

Use this skill to guide the agent in performing professional-grade technical analysis. Use `market_fetch` to get data and `indicators_compute` if you need custom calculations.

## 📊 Core Concepts

### 1. Trend Identification (The "River")

- **Bullish**: Price > EMA20 > EMA50. Higher Highs (HH) + Higher Lows (HL).
- **Bearish**: Price < EMA20 < EMA50. Lower Lows (LL) + Lower Highs (LH).
- **Ranging**: EMAs intertwining, price oscillating between support/resistance.

### 2. Momentum (The "Current")

- **RSI (14)**:
  - > 70: Overbought (potential reversal or strong trend).
  - < 30: Oversold (potential bounce).
  - **Divergence**: Price makes HH, RSI makes LH (Bearish Divergence).
- **MACD**:
  - Histogram flip: Momentum shift.
  - Crossover: Signal confirmation.

### 3. Volatility (The "Waves")

- **Bollinger Bands**:
  - **Squeeze**: Bands narrow (Low Volatility) → Expect explosive move.
  - **Expansion**: Bands widen → Trend accelerating.
- **ATR**: Measures average move. Used for Stop Loss placement (e.g., 2x ATR).

## 🛠️ Common Setups ("Recipes")

### Setup A: Trend Pullback (Continuation)

**Condition**:

1. Trend is clearly Bullish (Price > EMA50).
2. Price pulls back to EMA20 or EMA50.
3. RSI dumps to 40-50 (not oversold yet, but reset).
4. **Trigger**: Bullish candle (Hammer/Engulfing) off the EMA.

### Setup B: Reversal Divergence (Counter-Trend)

**Condition**:

1. Price makes a new swing High/Low.
2. RSI fails to make a new High/Low (Divergence).
3. Volume on the final push is lowering (Exhaustion).
4. **Trigger**: Break of previous candle low/high.

### Setup C: Breakout (Expansion)

**Condition**:

1. Price trapped in range (Triangle/Rectangle).
2. Volume declining during consolidation.
3. Bollinger Bands squeezing.
4. **Trigger**: Candle closes OUTSIDE the pattern on High Volume.

## 📝 Execution Checklist

1. **Fetch Data**: Get OHLCV for relevant timeframes (e.g., 1h, 4h, 1d).
2. **Identify Regime**: Is it Trending or Ranging?
3. **Check Signals**: Any Setups (A, B, or C) present?
4. **Verify Risk**: Where is the invalidate point (Stop Loss)?
5. **Report**: Summarize trend, key levels, and actionable signals.
