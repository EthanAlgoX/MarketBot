import { PriceDataFetcher } from "./priceData.js";
import { SECClient, extractFinancialFacts } from "./secApi.js";
import { FormulaEngine } from "./formulas.js";
import { calculateWilliamsR } from "./technicalIndicators.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import os from "os";

export type Market = "us" | "th";

export interface WatchedStock {
  ticker: string;
  market: Market;
  addedAt: string;
  notes?: string;
  alertThreshold?: number; // Williams %R threshold for alerts
  lastPrice?: number;
  lastWilliamsR?: number;
  lastBuffettScore?: number;
  lastCheckedAt?: string;
}

export interface WatchListData {
  stocks: WatchedStock[];
  updatedAt: string;
}

export interface StockStatus {
  ticker: string;
  market: Market;
  williamsR: number;
  price: number;
  changePercent: number;
  status: "normal" | "oversold" | "overbought" | "alert";
  buffettScore?: number;
}

export interface WatchListStatus {
  total: number;
  stocks: StockStatus[];
  checkedAt: string;
}

export interface AlertResult {
  ticker: string;
  market: Market;
  alertType: "oversold" | "overbought" | "threshold";
  message: string;
  currentPrice: number;
  currentWilliamsR: number;
}

const WATCHLIST_FILE = join(os.homedir(), ".claw-screener-watchlist.json");

function getMarketName(market: Market): string {
  return market === "us" ? "US Market" : " Thai Market";
}

function loadWatchList(): WatchListData {
  if (existsSync(WATCHLIST_FILE)) {
    try {
      const data = JSON.parse(readFileSync(WATCHLIST_FILE, "utf-8"));
      return {
        stocks: data.stocks || [],
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    } catch {
      return { stocks: [], updatedAt: new Date().toISOString() };
    }
  }
  return { stocks: [], updatedAt: new Date().toISOString() };
}

function saveWatchList(data: WatchListData): void {
  writeFileSync(WATCHLIST_FILE, JSON.stringify(data, null, 2));
}

export class WatchListManager {
  private data: WatchListData;

  constructor() {
    this.data = loadWatchList();
  }

  add(
    ticker: string,
    market: Market = "us",
    notes?: string,
    alertThreshold?: number
  ): boolean {
    const upperTicker = ticker.toUpperCase();
    const exists = this.data.stocks.some(
      (s) => s.ticker === upperTicker && s.market === market
    );

    if (exists) {
      return false;
    }

    this.data.stocks.push({
      ticker: upperTicker,
      market,
      addedAt: new Date().toISOString(),
      notes,
      alertThreshold,
    });

    this.data.updatedAt = new Date().toISOString();
    saveWatchList(this.data);
    return true;
  }

  remove(ticker: string, market?: Market): boolean {
    const upperTicker = ticker.toUpperCase();
    const initialLength = this.data.stocks.length;

    if (market) {
      this.data.stocks = this.data.stocks.filter(
        (s) => !(s.ticker === upperTicker && s.market === market)
      );
    } else {
      this.data.stocks = this.data.stocks.filter((s) => s.ticker !== upperTicker);
    }

    if (this.data.stocks.length < initialLength) {
      this.data.updatedAt = new Date().toISOString();
      saveWatchList(this.data);
      return true;
    }

    return false;
  }

  getAll(): WatchedStock[] {
    return [...this.data.stocks];
  }

  getByMarket(market: Market): WatchedStock[] {
    return this.data.stocks.filter((s) => s.market === market);
  }

  count(): number {
    return this.data.stocks.length;
  }

  update(
    ticker: string,
    market: Market,
    updates: Partial<WatchedStock>
  ): boolean {
    const stock = this.data.stocks.find(
      (s) => s.ticker === ticker.toUpperCase() && s.market === market
    );

    if (!stock) {
      return false;
    }

    Object.assign(stock, updates);
    this.data.updatedAt = new Date().toISOString();
    saveWatchList(this.data);
    return true;
  }

  async checkAlerts(): Promise<AlertResult[]> {
    const alerts: AlertResult[] = [];
    const priceFetcher = new PriceDataFetcher();

    for (const stock of this.data.stocks) {
      try {
        const result = await priceFetcher.fetchStockPrices(stock.ticker, 30);
        if (!result.success || !result.data) {
          continue;
        }

        const prices = result.data;
        const williamsR = calculateWilliamsR(prices);
        const currentWR = williamsR[williamsR.length - 1];

        if (!isNaN(currentWR)) {
          const currentPrice = prices[prices.length - 1].Close;

          // Check for oversold/overbought
          if (currentWR < -80) {
            alerts.push({
              ticker: stock.ticker,
              market: stock.market,
              alertType: "oversold",
              message: `${stock.ticker} is oversold (Williams %R: ${currentWR.toFixed(1)}) - potential buying opportunity`,
              currentPrice,
              currentWilliamsR: currentWR,
            });
          } else if (currentWR > -20) {
            alerts.push({
              ticker: stock.ticker,
              market: stock.market,
              alertType: "overbought",
              message: `${stock.ticker} is overbought (Williams %R: ${currentWR.toFixed(1)})`,
              currentPrice,
              currentWilliamsR: currentWR,
            });
          }

          // Check custom threshold
          if (stock.alertThreshold !== undefined) {
            const isBelow = currentWR < stock.alertThreshold;
            const isAbove = currentWR > -stock.alertThreshold; // For positive thresholds
            
            if (isBelow || (stock.alertThreshold > 0 && isAbove)) {
              alerts.push({
                ticker: stock.ticker,
                market: stock.market,
                alertType: "threshold",
                message: `${stock.ticker} hit custom threshold (Williams %R: ${currentWR.toFixed(1)}, threshold: ${stock.alertThreshold})`,
                currentPrice,
                currentWilliamsR: currentWR,
              });
            }
          }
        }
      } catch (e) {
        console.error(`Error checking alerts for ${stock.ticker}:`, e);
      }
    }

    priceFetcher.close();
    return alerts;
  }

  async getStatus(
    market?: Market,
    includeFundamentals: boolean = false
  ): Promise<WatchListStatus> {
    const stocks = market ? this.getByMarket(market) : this.getAll();
    const status: WatchListStatus = {
      total: stocks.length,
      stocks: [],
      checkedAt: new Date().toISOString(),
    };

    const priceFetcher = new PriceDataFetcher();
    let secClient: SECClient | null = null;

    if (includeFundamentals) {
      secClient = new SECClient();
    }

    for (const stock of stocks) {
      try {
        const result = await priceFetcher.fetchStockPrices(stock.ticker, 30);
        if (!result.success || !result.data) {
          continue;
        }

        const prices = result.data;
        const williamsR = calculateWilliamsR(prices);
        const currentWR = williamsR[williamsR.length - 1];

        if (isNaN(currentWR)) {
          continue;
        }

        const currentPrice = prices[prices.length - 1].Close;
        const priceChange = prices.length > 1
          ? ((currentPrice - prices[prices.length - 2].Close) / prices[prices.length - 2].Close) * 100
          : 0;

        // Get Buffett score if requested
        let buffettScore: number | undefined;
        if (includeFundamentals && secClient && stock.market === "us") {
          try {
            const cik = await secClient.resolveTickerToCik(stock.ticker);
            if (cik) {
              const companyFacts = await secClient.getCompanyFacts(cik);
              if (companyFacts) {
                const engine = new FormulaEngine(extractFinancialFacts(companyFacts));
                buffettScore = engine.getScore();
              }
            }
          } catch (e) {
            console.error(`Error getting Buffett score for ${stock.ticker}:`, e);
          }
        }

        let stockStatus: StockStatus["status"] = "normal";
        if (currentWR < -80) {
          stockStatus = "oversold";
        } else if (currentWR > -20) {
          stockStatus = "overbought";
        } else if (stock.alertThreshold !== undefined && currentWR < stock.alertThreshold) {
          stockStatus = "alert";
        }

        status.stocks.push({
          ticker: stock.ticker,
          market: stock.market,
          williamsR: currentWR,
          price: currentPrice,
          changePercent: priceChange,
          status: stockStatus,
          buffettScore,
        });

        stock.lastPrice = currentPrice;
        stock.lastWilliamsR = currentWR;
        stock.lastBuffettScore = buffettScore;
        stock.lastCheckedAt = new Date().toISOString();
      } catch (e) {
        console.error(`Error checking ${stock.ticker}:`, e);
      }
    }

    priceFetcher.close();
    if (secClient) {
      secClient.close();
    }

    // Save updated stock data
    for (const s of stocks) {
      this.update(s.ticker, s.market, {
        lastPrice: s.lastPrice,
        lastWilliamsR: s.lastWilliamsR,
        lastBuffettScore: s.lastBuffettScore,
        lastCheckedAt: s.lastCheckedAt,
      });
    }

    return status;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const manager = new WatchListManager();

  if (command === "add") {
    const ticker = args[1];
    if (!ticker) {
      console.error("Usage: bun run src/watchList.ts add <ticker> [--market us|th] [--notes '...'] [--alert-threshold -80]");
      process.exit(1);
    }

    let market: Market = "us";
    let notes: string | undefined;
    let alertThreshold: number | undefined;

    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--market" && i + 1 < args.length) {
        market = args[i + 1] as Market;
        i++;
      } else if (args[i] === "--notes" && i + 1 < args.length) {
        notes = args[i + 1];
        i++;
      } else if (args[i] === "--alert-threshold" && i + 1 < args.length) {
        alertThreshold = parseFloat(args[i + 1]);
        i++;
      }
    }

    const success = manager.add(ticker, market, notes, alertThreshold);
    if (success) {
      console.log(`✅ Added ${ticker} to watchlist (${market} market)`);
    } else {
      console.log(`⚠️  ${ticker} is already in watchlist`);
    }
  } else if (command === "remove") {
    const ticker = args[1];
    if (!ticker) {
      console.error("Usage: bun run src/watchList.ts remove <ticker> [--market us|th]");
      process.exit(1);
    }

    let market: Market | undefined;
    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--market" && i + 1 < args.length) {
        market = args[i + 1] as Market;
        i++;
      }
    }

    const success = manager.remove(ticker, market);
    if (success) {
      console.log(`✅ Removed ${ticker} from watchlist`);
    } else {
      console.log(`⚠️  ${ticker} not found in watchlist`);
    }
  } else if (command === "list") {
    let market: Market | undefined;
    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--market" && i + 1 < args.length) {
        market = args[i + 1] as Market;
        i++;
      }
    }

    const stocks = market ? manager.getByMarket(market) : manager.getAll();

    if (stocks.length === 0) {
      console.log("📭 Watchlist is empty");
      return;
    }

    console.log(`📋 Watchlist (${stocks.length} stocks):\n`);
    console.log("Ticker     | Market | Added");
    console.log("-----------|--------|-------------------");
    for (const stock of stocks) {
      const addedDate = new Date(stock.addedAt).toLocaleDateString();
      console.log(`${stock.ticker.padEnd(10)} | ${stock.market === "us" ? "US" : "TH"}    | ${addedDate}`);
    }
  } else if (command === "--help" || command === "-h" || !command) {
    console.log(`
📊 Watchlist Manager

Usage:
  bun run src/watchList.ts add <ticker> [options]
  bun run src/watchList.ts remove <ticker> [options]
  bun run src/watchList.ts list [options]

Commands:
  add <ticker>      Add a stock to watchlist
  remove <ticker>  Remove a stock from watchlist
  list             List all watched stocks

Options:
  --market us|th       Market (us or th), default: us
  --notes '...'        Optional notes for the stock
  --alert-threshold   Williams %R threshold for alerts (e.g., -80)
  --help, -h           Show this help message

Examples:
  bun run src/watchList.ts add AAPL
  bun run src/watchList.ts add AAPL --market us --notes 'Big tech'
  bun run src/watchList.ts add PTT.BK --market th
  bun run src/watchList.ts remove AAPL
  bun run src/watchList.ts list
  bun run src/watchList.ts list --market us
`);
  } else {
    console.error(`Unknown command: ${command}`);
    console.error("Use 'bun run src/watchList.ts --help' for usage information");
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}