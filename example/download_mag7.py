#!/usr/bin/env python3
"""
Download and analyze Magnificent Seven stocks data
"""

import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import os

# Set style for better visualizations
plt.style.use('seaborn-v0_8-darkgrid')
sns.set_palette("husl")

def download_stock_data():
    """Download Magnificent Seven stocks data for past 30 days"""
    
    # Magnificent Seven stocks
    symbols = ['AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'NVDA']
    
    # Calculate date range (past 30 days)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    print(f"Downloading data from {start_date.date()} to {end_date.date()}")
    
    # Download data
    data = yf.download(
        symbols,
        start=start_date,
        end=end_date,
        group_by='ticker',
        progress=True
    )
    
    return data, symbols

def analyze_data(data, symbols):
    """Perform analysis on downloaded data"""
    
    analysis_results = {}
    
    for symbol in symbols:
        if symbol in data.columns.levels[0]:
            df = data[symbol]
            
            # Basic statistics
            stats = {
                'current_price': df['Close'].iloc[-1],
                '30_day_high': df['High'].max(),
                '30_day_low': df['Low'].min(),
                '30_day_avg': df['Close'].mean(),
                '30_day_volatility': df['Close'].pct_change().std() * np.sqrt(252),  # Annualized
                'total_return': (df['Close'].iloc[-1] - df['Close'].iloc[0]) / df['Close'].iloc[0] * 100,
                'volume_avg': df['Volume'].mean()
            }
            
            # Calculate moving averages
            df['MA_5'] = df['Close'].rolling(window=5).mean()
            df['MA_20'] = df['Close'].rolling(window=20).mean()
            
            analysis_results[symbol] = {
                'stats': stats,
                'data': df
            }
            
            print(f"\n{symbol} Analysis:")
            print(f"  Current Price: ${stats['current_price']:.2f}")
            print(f"  30-day Return: {stats['total_return']:.2f}%")
            print(f"  30-day High: ${stats['30_day_high']:.2f}")
            print(f"  30-day Low: ${stats['30_day_low']:.2f}")
            print(f"  Annualized Volatility: {stats['30_day_volatility']:.2%}")
    
    return analysis_results

def create_visualizations(data, symbols, analysis_results):
    """Create visual charts for the analysis"""
    
    # Create output directory
    output_dir = "/Users/yunxuanhan/Documents/workspace/ai/MarketBot/example/charts"
    os.makedirs(output_dir, exist_ok=True)
    
    chart_files = []
    
    # 1. Price Performance Chart
    plt.figure(figsize=(14, 8))
    for symbol in symbols:
        if symbol in data.columns.levels[0]:
            df = data[symbol]
            # Normalize prices to compare performance
            normalized = df['Close'] / df['Close'].iloc[0] * 100
            plt.plot(df.index, normalized, label=symbol, linewidth=2)
    
    plt.title('Magnificent Seven: 30-Day Normalized Price Performance', fontsize=16, fontweight='bold')
    plt.xlabel('Date', fontsize=12)
    plt.ylabel('Normalized Price (Base=100)', fontsize=12)
    plt.legend(loc='best')
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    perf_chart = os.path.join(output_dir, 'mag7_performance.png')
    plt.savefig(perf_chart, dpi=150, bbox_inches='tight')
    chart_files.append(perf_chart)
    plt.close()
    
    # 2. Returns Comparison Chart
    plt.figure(figsize=(12, 6))
    returns = [analysis_results[symbol]['stats']['total_return'] for symbol in symbols if symbol in analysis_results]
    colors = plt.cm.Set3(np.linspace(0, 1, len(returns)))
    
    bars = plt.bar(range(len(returns)), returns, color=colors, edgecolor='black')
    plt.xticks(range(len(returns)), [s for s in symbols if s in analysis_results], rotation=45)
    plt.title('30-Day Total Returns (%)', fontsize=14, fontweight='bold')
    plt.ylabel('Return (%)', fontsize=12)
    plt.grid(True, alpha=0.3, axis='y')
    
    # Add value labels on bars
    for bar, value in zip(bars, returns):
        plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + (0.5 if value >= 0 else -1.5),
                f'{value:.1f}%', ha='center', va='bottom' if value >= 0 else 'top', fontweight='bold')
    
    plt.tight_layout()
    returns_chart = os.path.join(output_dir, 'mag7_returns.png')
    plt.savefig(returns_chart, dpi=150, bbox_inches='tight')
    chart_files.append(returns_chart)
    plt.close()
    
    # 3. Volatility Comparison
    plt.figure(figsize=(12, 6))
    volatilities = [analysis_results[symbol]['stats']['30_day_volatility'] * 100 for symbol in symbols if symbol in analysis_results]
    
    bars = plt.bar(range(len(volatilities)), volatilities, color=plt.cm.Pastel1(np.linspace(0, 1, len(volatilities))), edgecolor='black')
    plt.xticks(range(len(volatilities)), [s for s in symbols if s in analysis_results], rotation=45)
    plt.title('Annualized Volatility (%)', fontsize=14, fontweight='bold')
    plt.ylabel('Volatility (%)', fontsize=12)
    plt.grid(True, alpha=0.3, axis='y')
    
    for bar, value in zip(bars, volatilities):
        plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                f'{value:.1f}%', ha='center', va='bottom', fontweight='bold')
    
    plt.tight_layout()
    vol_chart = os.path.join(output_dir, 'mag7_volatility.png')
    plt.savefig(vol_chart, dpi=150, bbox_inches='tight')
    chart_files.append(vol_chart)
    plt.close()
    
    # 4. Individual Stock Charts (2x4 grid)
    fig, axes = plt.subplots(4, 2, figsize=(16, 20))
    axes = axes.flatten()
    
    for idx, symbol in enumerate(symbols):
        if idx < len(axes) and symbol in analysis_results:
            df = analysis_results[symbol]['data']
            ax = axes[idx]
            
            ax.plot(df.index, df['Close'], label='Close', color='blue', linewidth=2)
            ax.plot(df.index, df['MA_5'], label='5-day MA', color='orange', linestyle='--', alpha=0.7)
            ax.plot(df.index, df['MA_20'], label='20-day MA', color='red', linestyle='--', alpha=0.7)
            
            ax.set_title(f'{symbol} - Price & Moving Averages', fontsize=12, fontweight='bold')
            ax.set_xlabel('Date')
            ax.set_ylabel('Price ($)')
            ax.legend(loc='best')
            ax.grid(True, alpha=0.3)
            
            # Add current price annotation
            current_price = df['Close'].iloc[-1]
            ax.annotate(f'${current_price:.2f}', 
                       xy=(df.index[-1], current_price),
                       xytext=(10, 10), textcoords='offset points',
                       bbox=dict(boxstyle='round,pad=0.3', facecolor='yellow', alpha=0.7),
                       fontweight='bold')
    
    # Hide empty subplots
    for idx in range(len(symbols), len(axes)):
        axes[idx].set_visible(False)
    
    plt.suptitle('Magnificent Seven: Individual Stock Analysis', fontsize=16, fontweight='bold', y=0.98)
    plt.tight_layout()
    individual_chart = os.path.join(output_dir, 'mag7_individual.png')
    plt.savefig(individual_chart, dpi=150, bbox_inches='tight')
    chart_files.append(individual_chart)
    plt.close()
    
    # 5. Correlation Heatmap
    plt.figure(figsize=(10, 8))
    
    # Prepare correlation data
    close_prices = pd.DataFrame()
    for symbol in symbols:
        if symbol in data.columns.levels[0]:
            close_prices[symbol] = data[symbol]['Close']
    
    correlation_matrix = close_prices.corr()
    
    sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm', center=0,
                square=True, linewidths=1, cbar_kws={"shrink": 0.8})
    plt.title('Price Correlation Matrix', fontsize=14, fontweight='bold')
    plt.tight_layout()
    
    corr_chart = os.path.join(output_dir, 'mag7_correlation.png')
    plt.savefig(corr_chart, dpi=150, bbox_inches='tight')
    chart_files.append(corr_chart)
    plt.close()
    
    return chart_files

def generate_report(analysis_results, chart_files):
    """Generate a summary report"""
    
    report_path = "/Users/yunxuanhan/Documents/workspace/ai/MarketBot/example/mag7_analysis_report.md"
    
    with open(report_path, 'w') as f:
        f.write("# Magnificent Seven Stocks Analysis Report\n\n")
        f.write(f"**Analysis Date:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("**Period:** Past 30 days\n\n")
        
        f.write("## Summary Statistics\n\n")
        f.write("| Symbol | Current Price | 30-Day Return | 30-Day High | 30-Day Low | Volatility |\n")
        f.write("|--------|---------------|---------------|-------------|------------|------------|\n")
        
        for symbol in analysis_results:
            stats = analysis_results[symbol]['stats']
            f.write(f"| {symbol} | ${stats['current_price']:.2f} | {stats['total_return']:.2f}% | ${stats['30_day_high']:.2f} | ${stats['30_day_low']:.2f} | {stats['30_day_volatility']:.2%} |\n")
        
        f.write("\n## Key Findings\n\n")
        
        # Find best and worst performers
        returns = {symbol: analysis_results[symbol]['stats']['total_return'] for symbol in analysis_results}
        best = max(returns.items(), key=lambda x: x[1])
        worst = min(returns.items(), key=lambda x: x[1])
        
        f.write(f"1. **Best Performer:** {best[0]} with {best[1]:.2f}% return\n")
        f.write(f"2. **Worst Performer:** {worst[0]} with {worst[1]:.2f}% return\n")
        
        # Calculate average return
        avg_return = np.mean(list(returns.values()))
        f.write(f"3. **Average Return:** {avg_return:.2f}%\n")
        
        # Volatility analysis
        volatilities = {symbol: analysis_results[symbol]['stats']['30_day_volatility'] for symbol in analysis_results}
        most_volatile = max(volatilities.items(), key=lambda x: x[1])
        least_volatile = min(volatilities.items(), key=lambda x: x[1])
        
        f.write(f"4. **Most Volatile:** {most_volatile[0]} ({most_volatile[1]:.2%})\n")
        f.write(f"5. **Least Volatile:** {least_volatile[0]} ({least_volatile[1]:.2%})\n")
        
        f.write("\n## Generated Charts\n\n")
        for chart in chart_files:
            chart_name = os.path.basename(chart)
            f.write(f"1. `{chart_name}`\n")
        
        f.write("\n## Data Files\n\n")
        f.write("The raw data has been saved in the example directory.\n")
    
    print(f"\nReport generated: {report_path}")
    return report_path

def main():
    """Main execution function"""
    
    print("=" * 60)
    print("MAGNIFICENT SEVEN STOCKS ANALYSIS")
    print("=" * 60)
    
    try:
        # Step 1: Download data
        print("\n1. Downloading stock data...")
        data, symbols = download_stock_data()
        
        # Save raw data
        raw_data_path = "/Users/yunxuanhan/Documents/workspace/ai/MarketBot/example/mag7_raw_data.csv"
        data.to_csv(raw_data_path)
        print(f"   Raw data saved: {raw_data_path}")
        
        # Step 2: Analyze data
        print("\n2. Analyzing data...")
        analysis_results = analyze_data(data, symbols)
        
        # Step 3: Create visualizations
        print("\n3. Creating visualizations...")
        chart_files = create_visualizations(data, symbols, analysis_results)
        
        # Step 4: Generate report
        print("\n4. Generating report...")
        report_path = generate_report(analysis_results, chart_files)
        
        print("\n" + "=" * 60)
        print("ANALYSIS COMPLETE!")
        print("=" * 60)
        print(f"\nGenerated files:")
        print(f"  • Raw data: {raw_data_path}")
        print(f"  • Analysis report: {report_path}")
        print(f"  • Charts: {len(chart_files)} files in charts/ directory")
        
        # List all generated files
        print("\nChart files:")
        for chart in chart_files:
            print(f"  • {chart}")
            
    except Exception as e:
        print(f"\nError during analysis: {e}")
        import traceback
        traceback.print_exc()
        return None
    
    return chart_files

if __name__ == "__main__":
    main()