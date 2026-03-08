---
name: portfolio-analyzer
description: A comprehensive skill for analyzing, stress-testing, and optimizing a user's investment portfolio across risks, performance, and diversification.
metadata: {"marketbot":{"emoji":"📊","triggers":["portfolio","allocation","diversification","stress test"],"output":"portfolio-analysis-report","risk":"high","freshness":"end-of-day","tools":["market_snapshot","market_macro","market_news"],"required_tools":["market_snapshot"],"markets":["a-share","hong-kong","us","global","mixed"],"asset_classes":["portfolio"]}}
---

# Portfolio Analyzer

Use this skill to evaluate a user's collection of assets (portfolio). It orchestrates multiple tools and analysis methods to provide a holistic view of the portfolio's expected performance, risk distribution, and optimization potential.

## When to use

- User provides a list of tickers and weights/shares and asks for an analysis (e.g., `Analyze my portfolio: AAPL 30%, NVDA 20%, SPY 30%, BND 20%`).
- User asks about portfolio correlation, concentration risks, or diversification.
- User requests a backtest, scenario simulation (stress test), or optimization suggestion for their holdings.

## Comprehensive Analysis Pipeline

A full portfolio analysis will pass through several distinct analytical steps. If a user only asks for a specific aspect (e.g., "What is the beta of my portfolio?"), jump directly to that step. Otherwise, provide the full structured output.

### 1. Portfolio Parsing & Market Data Fetch

- Accept input flexibly: Extract tickers and calculate their relative weights (% of total portfolio).
- Fetch historical prices, volatility, market cap, and sector classifications for all assets in the portfolio over at least a 1-year window (or longer if requested).

### 2. Metrics Calculation

Compute the core performance indicators:

- **Expected Return (CAGR)**
- **Volatility (Annualized Standard Deviation)**
- **Sharpe Ratio & Sortino Ratio**
- **Max Drawdown**
- **Beta** (relative to SPY or another broad market index)

### 3. Risk & Diversification Analysis

- **Risk Decomposition**: Break down which assets contribute the most to the portfolio's overall volatility.
- **Correlation Matrix**: Identify highly correlated assets (e.g., AAPL and NVDA).
- **Concentration Risk**: Flag if a single stock (e.g., >20%) or a single sector (e.g., >40%) is overweight.
- **Diversification Score**: Assess the portfolio's balance across asset classes.

### 4. Scenario Simulation (Stress Testing)

Simulate how the portfolio would likely behave under adverse conditions:

- **Market Crash**: Simulate a rapid index drop.
- **Rate Hike**: Simulate rising interest rates.

### 5. Optimization & AI Insights

- **Optimization Strategy**: Suggest an alternative weighting (e.g., Mean-Variance or Max Sharpe) that improves the risk-adjusted return. Provide the *before* and *after* Sharpe ratio.
- **AI Summary**: Summarize the critical takeaways in plain English.

---

## Output Format

For a full portfolio review, use the following structured Markdown format:

```md
# 📊 Portfolio Analysis Report

## 📈 1. Portfolio Overview
- **Holdings**: <Asset 1 (Weight)>, <Asset 2 (Weight)>...
- **Expected Return (CAGR)**: <%>
- **Volatility**: <%>
- **Sharpe Ratio**: <Ratio>
- **Max Drawdown**: <%>

## ⚠️ 2. Risk & Correlation Analysis
- **Highest Risk Contributor**: <Asset> (<% of total risk>)
- **Correlation Warning**: <e.g., High correlation (0.72) between AAPL and NVDA>
- **Concentration Risk**: <Note on sector or single-stock overweight>

## 🌪️ 3. Scenario Stress Test
- **Market Crash Scenario**: Expected impact <%>
- **Best Asset in Downturn**: <Asset>
- **Worst Asset in Downturn**: <Asset>

## 💡 4. Optimization Recommendations
<Provide a suggested re-weighting to maximize Sharpe Ratio or minimize variance>
- **Current Sharpe**: <Old> ➡️ **Optimized Sharpe**: <New>

## 🤖 5. AI Key Insights
1. <Insight 1, e.g., "Portfolio is heavily concentrated in tech (50%+)">
2. <Insight 2, e.g., "Adding fixed income or international equity could improve diversification">
```

## Supported Tools

To execute this skill, combine the agent's general data fetching capabilities (prices, historical data) with strong mathematical reasoning (calculating correlations, standard deviations) and AI summarization.
