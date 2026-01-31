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
  const htmlFirst = await fetchYahooQuoteFromHtml(symbol, timeoutMs);
  if (htmlFirst) return htmlFirst;

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  let data: YahooQuoteResponse | null = null;
  try {
    data = await retry(() => fetchJson<YahooQuoteResponse>(url, { timeout: timeoutMs }));
  } catch {
    return null;
  }

  const result = data.quoteResponse?.result?.[0];
  if (!result) return null;

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

  if (price == null) return null;

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

export async function fetchYahooQuoteFromHtml(symbol: string, timeoutMs?: number): Promise<QuoteSnapshot | null> {
  const url = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
  try {
    const response = await fetchWithTimeout(url, {
      timeout: timeoutMs,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      console.warn(`Yahoo HTML fetch failed: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Parse fin-streamer tags
    const streamers: Record<string, string> = {};
    const tagRegex = /<fin-streamer\b[^>]*>/g;
    let match;

    const getAttr = (tag: string, name: string) => {
      const m = tag.match(new RegExp(`${name}="([^"]*)"`, "i"));
      return m ? m[1] : null;
    };

    while ((match = tagRegex.exec(html)) !== null) {
      const tag = match[0];
      const field = getAttr(tag, "data-field");
      const tagSymbol = getAttr(tag, "data-symbol");
      const value = getAttr(tag, "data-value") || getAttr(tag, "value"); // Support both data-value and value

      if (field && value) {
        // Strict check: If symbol is present, it MUST match the requested symbol
        // If symbol is missing, assume it belongs to the page's main asset
        if (tagSymbol && tagSymbol !== symbol) {
          continue;
        }
        streamers[field] = value;
      }
    }

    const price = parseFloat(streamers["regularMarketPrice"] || "");
    if (isNaN(price)) {
      console.warn(`[Yahoo] No regularMarketPrice found for ${symbol}`);
      return null;
    }

    return {
      symbol,
      price,
      change: parseFloat(streamers["regularMarketChange"] || "0"),
      changePercent: parseFloat(streamers["regularMarketChangePercent"] || "0"),
      timestamp: new Date().toISOString(), // Fallback as scraping timestamp is unreliable
      source: "yahoo-finance-html(backup)",
      priceType: "regular",
    };

  } catch (err) {
    console.warn(`HTML scrape error for ${symbol}:`, err);
    return null;
  }
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
