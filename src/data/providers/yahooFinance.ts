// Yahoo Finance quote provider

import { fetchJson, fetchWithTimeout, retry } from "./providerUtils.js";
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

  let data: YahooQuoteResponse | null = null;
  try {
    data = await retry(() => fetchJson<YahooQuoteResponse>(url, { timeout: timeoutMs }));
  } catch {
    // fall through to HTML fallback
  }

  const result = data?.quoteResponse?.result?.[0];

  let price = result?.regularMarketPrice;
  let time = result?.regularMarketTime;
  let priceType: QuoteSnapshot["priceType"] = "regular";

  if (price == null && result?.postMarketPrice != null) {
    price = result.postMarketPrice;
    time = result.postMarketTime;
    priceType = "post";
  }

  if (price == null && result?.preMarketPrice != null) {
    price = result.preMarketPrice;
    time = result.preMarketTime;
    priceType = "pre";
  }

  if (price == null) {
    const fallback = await fetchYahooQuoteFromHtml(symbol, timeoutMs);
    return fallback;
  }

  return {
    symbol: result?.symbol ?? symbol,
    price,
    currency: result?.currency,
    exchange: result?.fullExchangeName,
    marketState: result?.marketState,
    source: "yahoo-finance",
    timestamp: time ? new Date(time * 1000).toISOString() : undefined,
    priceType,
  };
}

async function fetchYahooQuoteFromHtml(symbol: string, timeoutMs?: number): Promise<QuoteSnapshot | null> {
  const url = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
  const response = await fetchWithTimeout(url, {
    timeout: timeoutMs,
    headers: {
      // Ensure we get the desktop site which definitely has fin-streamer
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  if (!response.ok) return null;
  const html = await response.text();

  // Try to find <fin-streamer> tags which are specific to the symbol
  // Example: <fin-streamer data-symbol="GOOGL" ... data-field="regularMarketPrice" value="175.5">
  const cleanSymbol = symbol.toUpperCase();

  const extractPrice = (field: string): number | undefined => {
    // Regex matches: data-symbol="SYMBOL" ... data-field="FIELD" ... value="NUMBER"
    // Handle attributes in any order
    const regex = new RegExp(
      `<fin-streamer[^>]*data-symbol="${cleanSymbol}"[^>]*data-field="${field}"[^>]*value="([0-9.]+)"`,
      "i"
    );
    const match = html.match(regex);
    if (!match) return undefined;
    return Number(match[1]);
  };

  const regularPrice = extractPrice("regularMarketPrice");
  const postPrice = extractPrice("postMarketPrice");
  const prePrice = extractPrice("preMarketPrice");

  // Determine effective price
  let price = regularPrice;
  let priceType: QuoteSnapshot["priceType"] = "regular";

  // If regular price is missing, or if pre/post is more relevant? 
  // Usually we prefer regular, but if market is closed, user might want post. 
  // For simplicity, prioritize post/pre if regular is missing, or if we want to detect state.
  // Existing logic prioritized result.regularMarketPrice.

  if (price == null && postPrice != null) {
    price = postPrice;
    priceType = "post";
  }
  if (price == null && prePrice != null) {
    price = prePrice;
    priceType = "pre";
  }

  // Fallback to strict JSON regex if fin-streamer fails (sometimes Yahoo changes layout)
  // Fallback to strict JSON regex if fin-streamer fails (sometimes Yahoo changes layout)
  if (price == null) {
    // Disabled loose fallback to avoid returning BTC price for irrelevant symbols.
    console.warn(`[Yahoo] Failed to extract price for ${symbol} via fin-streamer.`);
    return null;
    // return fetchYahooQuoteFromHtmlJsonFallback(html, symbol);
  }

  return {
    symbol: cleanSymbol,
    price,
    currency: "USD", // fin-streamer doesn't easily show currency, default for now or parse
    exchange: "Unknown",
    marketState: "Unknown",
    source: "yahoo-finance-html(streamer)",
    timestamp: new Date().toISOString(),
    priceType,
  };
}

function fetchYahooQuoteFromHtmlJsonFallback(html: string, symbol: string): QuoteSnapshot | null {
  // Original JSON regex logic but maybe scoped or just as is for last resort
  const priceMatch = matchRawNumber(html, ["regularMarketPrice", "currentPrice"]);
  if (!priceMatch) return null;
  return {
    symbol,
    price: priceMatch.value,
    currency: matchString(html, ["currency"]),
    exchange: matchString(html, ["fullExchangeName"]),
    marketState: matchString(html, ["marketState"]),
    source: "yahoo-finance-html(fallback)",
    timestamp: new Date().toISOString(),
    priceType: "regular"
  };
}

function matchRawNumber(html: string, keys: string[]): { key: string; value: number } | null {
  for (const key of keys) {
    const regex = new RegExp(`"${key}"\\s*:\\s*\\{"raw"\\s*:\\s*([0-9.]+)`, "i");
    const match = html.match(regex);
    if (match?.[1]) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) return { key, value };
    }
  }
  return null;
}

function matchNumber(html: string, keys: string[]): number | undefined {
  for (const key of keys) {
    const regex = new RegExp(`"${key}"\\s*:\\s*([0-9]+)`, "i");
    const match = html.match(regex);
    if (match?.[1]) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) return value;
    }
  }
  return undefined;
}

function matchString(html: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const regex = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, "i");
    const match = html.match(regex);
    if (match?.[1]) return match[1];
  }
  return undefined;
}
