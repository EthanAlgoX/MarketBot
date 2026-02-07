/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import { fetchTextWithBrowser } from "./browser-client.js";
import { TtlCache } from "./cache.js";
import { resolveYahooRange } from "./timeframe.js";
import {
  buildYahooChartUrl,
  buildYahooFundamentalsUrl,
  buildYahooQuoteUrl,
  normalizeYahooSymbol,
  parseYahooChart,
  parseYahooFundamentals,
  parseYahooJsonFromText,
  parseYahooQuotes,
} from "./yahoo.js";
import type { Fundamentals, MarketSeries, NewsItem, Quote } from "./types.js";
import { parseGoogleNewsRss } from "./news.js";
import { buildStooqDailyUrl, parseStooqDailyCsv, resolveStooqSymbol } from "./stooq.js";

export type MarketDataClientOptions = {
  profile?: string;
  cacheTtlMs?: number;
};

function quoteFromSeries(series: MarketSeries): Quote {
  const points = series.series.filter((p) => typeof p.close === "number");
  const last = points.at(-1);
  if (!last || typeof last.close !== "number") {
    throw new Error(`No close price available for ${series.symbol}`);
  }
  const prev = points.length >= 2 ? points.at(-2) : undefined;
  const prevClose = prev && typeof prev.close === "number" ? prev.close : undefined;
  const change = prevClose !== undefined ? last.close - prevClose : undefined;
  const changePct =
    prevClose !== undefined && prevClose !== 0 ? (change ?? 0) / prevClose : undefined;
  return {
    symbol: series.symbol,
    ...(series.currency ? { currency: series.currency } : {}),
    ...(series.exchange ? { exchange: series.exchange } : {}),
    regularMarketPrice: last.close,
    ...(typeof last.ts === "number" ? { regularMarketTime: last.ts } : {}),
    ...(change !== undefined ? { regularMarketChange: change } : {}),
    ...(changePct !== undefined ? { regularMarketChangePercent: changePct } : {}),
    marketState: "CLOSED",
  };
}

export class MarketDataClient {
  private chartCache: TtlCache<MarketSeries>;
  private quoteCache: TtlCache<Quote[]>;
  private fundamentalsCache: TtlCache<Fundamentals>;
  private newsCache: TtlCache<NewsItem[]>;
  private profile?: string;

  constructor(opts: MarketDataClientOptions = {}) {
    this.profile = opts.profile;
    const ttl = opts.cacheTtlMs ?? 60_000;
    this.chartCache = new TtlCache<MarketSeries>(ttl);
    this.quoteCache = new TtlCache<Quote[]>(ttl);
    this.fundamentalsCache = new TtlCache<Fundamentals>(ttl);
    this.newsCache = new TtlCache<NewsItem[]>(ttl);
  }

  async getMarketData(params: { symbol: string; timeframe?: string; limit?: number }) {
    const range = resolveYahooRange(params.timeframe);
    const symbol = normalizeYahooSymbol(params.symbol);
    const cacheKey = `${symbol}:${range.range}:${range.interval}`;
    const cached = this.chartCache.get(cacheKey);
    if (cached) {
      return params.limit ? { ...cached, series: cached.series.slice(-params.limit) } : cached;
    }
    const url = buildYahooChartUrl({
      symbol,
      range: range.range,
      interval: range.interval,
      includePrePost: false,
    });
    let series: MarketSeries;
    try {
      const res = await fetchTextWithBrowser(url, {
        profile: this.profile,
        maxChars: 200000,
        retryMaxChars: 400000,
        content: "text",
      });
      const json = parseYahooJsonFromText(res.text);
      series = parseYahooChart(json);
    } catch (err) {
      // Fallback: Stooq daily CSV (works well for equities when Yahoo API is rate limited).
      if (range.interval !== "1d") {
        throw err;
      }
      const stooq = resolveStooqSymbol(symbol);
      if (!stooq) {
        throw err;
      }
      const res = await fetchTextWithBrowser(buildStooqDailyUrl(stooq), {
        profile: this.profile,
        maxChars: 200000,
        content: "text",
      });
      series = parseStooqDailyCsv(res.text, symbol);
    }
    this.chartCache.set(cacheKey, series);
    return params.limit ? { ...series, series: series.series.slice(-params.limit) } : series;
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const normalized = symbols.map(normalizeYahooSymbol).filter(Boolean);
    const cacheKey = normalized.join(",");
    const cached = this.quoteCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const url = buildYahooQuoteUrl(normalized);
    let quotes: Quote[];
    try {
      const res = await fetchTextWithBrowser(url, {
        profile: this.profile,
        maxChars: 120000,
        retryMaxChars: 240000,
        content: "text",
      });
      const json = parseYahooJsonFromText(res.text);
      quotes = parseYahooQuotes(json);
      if (quotes.length === 0) {
        throw new Error("Yahoo quote API returned no results");
      }
    } catch {
      // Fallback: derive a quote from the latest close in the daily chart.
      quotes = [];
      for (const sym of normalized) {
        const series = await this.getMarketData({ symbol: sym, timeframe: "5d", limit: 2 });
        quotes.push(quoteFromSeries(series));
      }
    }
    this.quoteCache.set(cacheKey, quotes);
    return quotes;
  }

  async getFundamentals(symbol: string): Promise<Fundamentals> {
    const normalized = normalizeYahooSymbol(symbol);
    const cacheKey = normalized;
    const cached = this.fundamentalsCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    try {
      const url = buildYahooFundamentalsUrl(normalized);
      const res = await fetchTextWithBrowser(url, {
        profile: this.profile,
        maxChars: 200000,
        retryMaxChars: 400000,
        content: "text",
      });
      const json = parseYahooJsonFromText(res.text);
      const fundamentals = parseYahooFundamentals(json, normalized);
      this.fundamentalsCache.set(cacheKey, fundamentals);
      return fundamentals;
    } catch {
      // Keep higher-level commands stable even if fundamentals are temporarily unavailable.
      return { symbol: normalized.toUpperCase() };
    }
  }

  async getNews(params: { query: string; limit?: number; locale?: string }): Promise<NewsItem[]> {
    const trimmed = params.query.trim();
    if (!trimmed) {
      throw new Error("news query required");
    }
    const cacheKey = `${trimmed}:${params.locale ?? "US"}`;
    const cached = this.newsCache.get(cacheKey);
    if (cached) {
      return params.limit ? cached.slice(0, params.limit) : cached;
    }
    const locale = params.locale ?? "US";
    const q = new URLSearchParams();
    q.set("q", trimmed);
    q.set("hl", "en-US");
    q.set("gl", locale);
    q.set("ceid", `${locale}:en`);
    const url = `https://news.google.com/rss/search?${q.toString()}`;
    const res = await fetchTextWithBrowser(url, {
      profile: this.profile,
      maxChars: 200000,
      content: "text",
    });
    const items = parseGoogleNewsRss(res.text);
    this.newsCache.set(cacheKey, items);
    return params.limit ? items.slice(0, params.limit) : items;
  }
}
