// Yahoo Finance quote provider

import { fetchJson, retry } from "./providerUtils.js";
import type { QuoteSnapshot } from "../types.js";

interface YahooQuoteResponse {
  quoteResponse?: {
    result?: Array<{
      symbol?: string;
      regularMarketPrice?: number;
      regularMarketTime?: number;
      postMarketPrice?: number;
      postMarketTime?: number;
      preMarketPrice?: number;
      preMarketTime?: number;
      currency?: string;
      fullExchangeName?: string;
      marketState?: string;
    }>;
    error?: { description?: string } | null;
  };
}

export async function fetchYahooQuote(symbol: string, timeoutMs?: number): Promise<QuoteSnapshot | null> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;

  const data = await retry(() => fetchJson<YahooQuoteResponse>(url, { timeout: timeoutMs }));
  const result = data.quoteResponse?.result?.[0];
  if (!result) return null;

  let price = result.regularMarketPrice;
  let time = result.regularMarketTime;
  let priceType: QuoteSnapshot["priceType"] = "regular";

  if (price == null && result.postMarketPrice != null) {
    price = result.postMarketPrice;
    time = result.postMarketTime;
    priceType = "post";
  }

  if (price == null && result.preMarketPrice != null) {
    price = result.preMarketPrice;
    time = result.preMarketTime;
    priceType = "pre";
  }

  if (price == null) return null;

  return {
    symbol: result.symbol ?? symbol,
    price,
    currency: result.currency,
    exchange: result.fullExchangeName,
    marketState: result.marketState,
    source: "yahoo-finance",
    timestamp: time ? new Date(time * 1000).toISOString() : undefined,
    priceType,
  };
}
