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
  const response = await fetchWithTimeout(url, { timeout: timeoutMs });
  if (!response.ok) return null;
  const html = await response.text();

  const priceMatch = matchRawNumber(html, ["regularMarketPrice", "currentPrice", "postMarketPrice", "preMarketPrice"]);
  if (!priceMatch) return null;

  const { value: price, key: priceKey } = priceMatch;
  const time = matchNumber(html, ["regularMarketTime", "postMarketTime", "preMarketTime"]);
  const currency = matchString(html, ["currency"]);
  const exchange = matchString(html, ["fullExchangeName"]);
  const marketState = matchString(html, ["marketState"]);
  const symbolMatch = matchString(html, ["symbol"]) ?? symbol;

  let priceType: QuoteSnapshot["priceType"] = "regular";
  if (priceKey === "postMarketPrice") priceType = "post";
  if (priceKey === "preMarketPrice") priceType = "pre";

  return {
    symbol: symbolMatch,
    price,
    currency,
    exchange,
    marketState,
    source: "yahoo-finance-html",
    timestamp: time ? new Date(time * 1000).toISOString() : undefined,
    priceType,
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
