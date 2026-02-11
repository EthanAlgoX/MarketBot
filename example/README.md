# Magnificent Seven Stocks Analysis

## Overview
This project analyzes the performance of the "Magnificent Seven" U.S. stocks over the past 30 days. The analysis includes data download, statistical analysis, visualization, and reporting.

## Stocks Analyzed
- **AAPL** (Apple Inc.)
- **MSFT** (Microsoft Corporation)
- **AMZN** (Amazon.com Inc.)
- **GOOGL** (Alphabet Inc.)
- **META** (Meta Platforms Inc.)
- **TSLA** (Tesla Inc.)
- **NVDA** (NVIDIA Corporation)

## Analysis Components

### 1. Data Collection
- Downloaded 30 days of historical data using Yahoo Finance API
- Includes Open, High, Low, Close prices and Volume
- Data saved as `mag7_raw_data.csv`

### 2. Statistical Analysis
- Current price and 30-day price range
- Total return over 30 days
- Annualized volatility
- Moving averages (5-day and 20-day)

### 3. Visualizations
Generated 5 charts:
1. **Normalized Price Performance** - Shows relative performance of all stocks
2. **30-Day Returns Comparison** - Bar chart of total returns
3. **Volatility Comparison** - Bar chart of annualized volatility
4. **Individual Stock Analysis** - 2x4 grid with price and moving averages
5. **Correlation Heatmap** - Shows price correlations between stocks

### 4. Report
- Summary statistics table
- Key findings and insights
- List of generated files

## Key Findings (as of 2026-02-11)
1. **Best Performer**: AAPL (+7.23%)
2. **Worst Performer**: AMZN (-15.26%)
3. **Average Return**: -3.51%
4. **Most Volatile**: META (50.88% annualized)
5. **Least Volatile**: GOOGL (21.57% annualized)

## Files Generated
- `mag7_raw_data.csv` - Raw historical data
- `mag7_analysis_report.md` - Analysis report
- `charts/mag7_performance.png` - Performance chart
- `charts/mag7_returns.png` - Returns comparison
- `charts/mag7_volatility.png` - Volatility comparison
- `charts/mag7_individual.png` - Individual stock charts
- `charts/mag7_correlation.png` - Correlation heatmap

## How to Run
```bash
cd /Users/yunxuanhan/Documents/workspace/ai/MarketBot/example
python3 download_mag7.py
```

## Dependencies
- Python 3.x
- yfinance
- pandas
- numpy
- matplotlib
- seaborn

## Notes
- Data is fetched from Yahoo Finance
- Analysis period: Past 30 days from current date
- Volatility is annualized using 252 trading days
- All prices in USD