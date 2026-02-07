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

export type MarketDataClientOptions = {
  profile?: string;
  cacheTtlMs?: number;
};

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
    const res = await fetchTextWithBrowser(url, {
      profile: this.profile,
      maxChars: 200000,
      retryMaxChars: 400000,
    });
    const json = parseYahooJsonFromText(res.text);
    const series = parseYahooChart(json);
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
    const res = await fetchTextWithBrowser(url, {
      profile: this.profile,
      maxChars: 120000,
      retryMaxChars: 240000,
    });
    const json = parseYahooJsonFromText(res.text);
    const quotes = parseYahooQuotes(json);
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
    const url = buildYahooFundamentalsUrl(normalized);
    const res = await fetchTextWithBrowser(url, {
      profile: this.profile,
      maxChars: 200000,
      retryMaxChars: 400000,
    });
    const json = parseYahooJsonFromText(res.text);
    const fundamentals = parseYahooFundamentals(json, normalized);
    this.fundamentalsCache.set(cacheKey, fundamentals);
    return fundamentals;
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
    });
    const items = parseGoogleNewsRss(res.text);
    this.newsCache.set(cacheKey, items);
    return params.limit ? items.slice(0, params.limit) : items;
  }
}
