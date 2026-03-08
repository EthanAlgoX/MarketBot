import YahooFinance from "yahoo-finance2";
import { PriceDataManager, OHLC } from "./database.js";

const yahooFinance = new YahooFinance({ suppressNotices: ["ripHistorical"], validation: { logErrors: false } });

export interface PriceResult {
  ticker: string;
  success: boolean;
  data?: OHLC[];
  error?: string;
}

export class PriceDataFetcher {
  private cache: PriceDataManager;

  constructor(cacheDb: string = "price_cache.db") {
    this.cache = new PriceDataManager(cacheDb);
  }

  async fetchStockPrices(
    ticker: string,
    days: number = 90,
    forceRefresh: boolean = false
  ): Promise<PriceResult> {
    if (!forceRefresh) {
      const cached = await this.cache.getPrices(ticker);
      if (cached) {
        return { ticker, success: true, data: cached };
      }
    }

    try {
      const quote = await yahooFinance.historical(ticker, {
        period1: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        period2: new Date(),
        interval: "1d",
      });

      if (!quote || quote.length === 0) {
        return { ticker, success: false, error: "No data" };
      }

      const data: OHLC[] = quote.map((item) => ({
        Date: item.date.toISOString().split("T")[0],
        Open: item.open,
        High: item.high,
        Low: item.low,
        Close: item.close,
        Volume: item.volume,
      }));

      await this.cache.setPrices(ticker, data);

      return { ticker, success: true, data };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return { ticker, success: false, error };
    }
  }

  async batchFetchPrices(
    tickers: string[],
    days: number = 90,
    maxWorkers: number = 10
  ): Promise<Record<string, PriceResult>> {
    const results: Record<string, PriceResult> = {};
    const chunks: string[][] = [];

    for (let i = 0; i < tickers.length; i += maxWorkers) {
      chunks.push(tickers.slice(i, i + maxWorkers));
    }

    for (const chunk of chunks) {
      const promises = chunk.map((ticker) =>
        this.fetchStockPrices(ticker, days)
      );
      const batchResults = await Promise.all(promises);
      for (const result of batchResults) {
        results[result.ticker] = result;
      }
    }

    return results;
  }

  close(): void {
    this.cache.close();
  }
}
