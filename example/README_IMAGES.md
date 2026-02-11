# Magnificent Seven Stocks Analysis - Generated Files

## Analysis Complete!
Date: 2026-02-11 23:54:20
Period: Past 30 days (2026-01-12 to 2026-02-11)

## 📊 Generated Charts

All charts are saved in: `/Users/yunxuanhan/Documents/workspace/ai/MarketBot/example/charts/`

### 1. Performance Chart
**File:** `mag7_performance.png`
**Description:** Shows normalized price performance (base=100) for all 7 stocks over 30 days
**Key Insight:** AAPL and META showed strongest upward trends

### 2. Returns Chart
**File:** `mag7_returns.png`
**Description:** Bar chart comparing 30-day total returns for each stock
**Key Insight:** AAPL (+7.11%) best, AMZN (-15.02%) worst

### 3. Volatility Chart
**File:** `mag7_volatility.png`
**Description:** Bar chart showing annualized volatility for each stock
**Key Insight:** META most volatile (50.88%), GOOGL least volatile (21.35%)

### 4. Individual Analysis
**File:** `mag7_individual.png`
**Description:** 2x4 grid showing each stock's price with 5-day and 20-day moving averages
**Key Insight:** Detailed technical analysis for each stock

### 5. Correlation Matrix
**File:** `mag7_correlation.png`
**Description:** Heatmap showing price correlations between stocks
**Key Insight:** Shows which stocks move together

## 📈 Summary Statistics

| Symbol | Current Price | 30-Day Return | 30-Day High | 30-Day Low | Volatility |
|--------|---------------|---------------|-------------|------------|------------|
| AAPL | $279.35 | +7.11% | $280.65 | $243.19 | 26.36% |
| MSFT | $405.04 | -13.94% | $483.74 | $392.32 | 48.29% |
| AMZN | $206.15 | -15.02% | $247.78 | $200.31 | 33.24% |
| GOOGL | $313.24 | -6.77% | $349.00 | $306.46 | 21.35% |
| META | $671.47 | +6.40% | $744.00 | $600.00 | 50.88% |
| TSLA | $424.85 | -5.00% | $452.43 | $387.53 | 39.89% |
| NVDA | $191.80 | +3.22% | $194.49 | $171.03 | 43.63% |

## 🔍 Key Findings

1. **Performance Split:** 3 stocks positive (AAPL, META, NVDA), 4 negative
2. **Best Performer:** AAPL (+7.11%)
3. **Worst Performer:** AMZN (-15.02%)
4. **Average Return:** -3.43%
5. **Risk-Reward:** META offers highest volatility (50.88%) with good returns (+6.40%)
6. **Stability:** GOOGL has lowest volatility (21.35%) but negative return (-6.77%)

## 📁 Data Files

1. **Raw Data:** `mag7_raw_data.csv` - Complete historical data for all 7 stocks
2. **Analysis Report:** `mag7_analysis_report.md` - Detailed markdown report
3. **Python Script:** `download_mag7.py` - Script used for analysis

## 🚀 How to View Images

### Option 1: Direct File Access
Open Finder and navigate to:
```
/Users/yunxuanhan/Documents/workspace/ai/MarketBot/example/charts/
```

### Option 2: Terminal Preview
```bash
# Install image preview tool
brew install chafa

# Preview images
chafa /Users/yunxuanhan/Documents/workspace/ai/MarketBot/example/charts/mag7_performance.png
```

### Option 3: Python Display
```python
from PIL import Image
import matplotlib.pyplot as plt
import matplotlib.image as mpimg

img = mpimg.imread('/Users/yunxuanhan/Documents/workspace/ai/MarketBot/example/charts/mag7_performance.png')
plt.imshow(img)
plt.axis('off')
plt.show()
```

## 📈 Market Insights

1. **Tech Sector Divergence:** Not all tech stocks moving together - clear winners and losers
2. **Volatility Clustering:** High volatility stocks (META, MSFT, NVDA) showing different return patterns
3. **Moving Average Signals:** Check individual charts for MA crossovers indicating trend changes
4. **Correlation Patterns:** Some stocks show strong correlation (tech peers), others less so

## 🔄 Next Steps

1. **Extend Timeframe:** Run analysis for 90 days or 1 year
2. **Add Indicators:** Include RSI, MACD, Bollinger Bands
3. **Compare to Benchmarks:** Add SPY (S&P 500) for comparison
4. **Portfolio Analysis:** Calculate optimal portfolio weights
5. **Risk Metrics:** Add Value at Risk (VaR), Sharpe ratio