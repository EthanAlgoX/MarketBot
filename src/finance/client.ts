/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import type { MarketBotConfig } from "../config/config.js";
import { TtlCache } from "./cache.js";
import { resolveYahooRange } from "./timeframe.js";
import type { Fundamentals, MarketSeries, NewsItem, Quote } from "./types.js";
import {
  createFinanceProviderRegistry,
  normalizeFinanceProviderId,
  type FinanceProvider,
} from "./providers.js";
import { normalizeYahooSymbol } from "./yahoo.js";

export type MarketDataClientOptions = {
  profile?: string;
  cacheTtlMs?: number;
  provider?: string;
  providerOrder?: string[];
  config?: MarketBotConfig;
};

type FinanceAction = "market_data" | "quote" | "fundamentals" | "news";

const DEFAULT_PROVIDER_ORDER: Record<FinanceAction, string[]> = {
  market_data: ["yahoo", "stooq"],
  quote: ["yahoo", "stooq"],
  fundamentals: ["yahoo"],
  news: ["google-news"],
};

function quoteFromSeries(series: MarketSeries, fallbackSymbol: string): Quote {
  const points = series.series.filter((point) => typeof point.close === "number");
  const last = points.at(-1);
  const symbol = series.symbol || fallbackSymbol.toUpperCase();
  if (!last || typeof last.close !== "number") {
    return {
      symbol,
      ...(series.currency ? { currency: series.currency } : {}),
      ...(series.exchange ? { exchange: series.exchange } : {}),
      marketState: "UNKNOWN",
    };
  }
  const prev = points.length >= 2 ? points.at(-2) : undefined;
  const prevClose = prev && typeof prev.close === "number" ? prev.close : undefined;
  const change = prevClose !== undefined ? last.close - prevClose : undefined;
  const changePct =
    prevClose !== undefined && prevClose !== 0 ? (change ?? 0) / prevClose : undefined;
  return {
    symbol,
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
  private provider?: string;
  private providerOrder?: string[];
  private config?: MarketBotConfig;
  private registry: Map<string, FinanceProvider>;

  constructor(opts: MarketDataClientOptions = {}) {
    this.profile = opts.profile;
    this.provider = opts.provider?.trim();
    this.providerOrder = opts.providerOrder?.map((entry) => entry.trim()).filter(Boolean);
    this.config = opts.config;
    const ttl = opts.cacheTtlMs ?? 60_000;
    this.chartCache = new TtlCache<MarketSeries>(ttl);
    this.quoteCache = new TtlCache<Quote[]>(ttl);
    this.fundamentalsCache = new TtlCache<Fundamentals>(ttl);
    this.newsCache = new TtlCache<NewsItem[]>(ttl);
    this.registry = createFinanceProviderRegistry(this.config);
  }

  private providerSupportsAction(provider: FinanceProvider, action: FinanceAction): boolean {
    if (action === "market_data") {
      return provider.capabilities.marketData === true;
    }
    if (action === "quote") {
      return provider.capabilities.quotes === true;
    }
    if (action === "fundamentals") {
      return provider.capabilities.fundamentals === true;
    }
    return provider.capabilities.news === true;
  }

  private resolveAutoConnectedPriority(action: FinanceAction): string[] {
    // If OpenBB is connected in config, try it first by default to honor
    // "connect once" semantics without requiring per-call provider flags.
    const openbb = this.registry.get("openbb");
    if (!openbb || !this.providerSupportsAction(openbb, action)) {
      return [];
    }
    return ["openbb"];
  }

  private resolveProviderOrder(action: FinanceAction): string[] {
    const configuredByAction = this.config?.finance?.providerOrderByAction?.[action];
    const configuredOrder = this.providerOrder ?? this.config?.finance?.providerOrder;
    const preferredProvider = this.provider ?? this.config?.finance?.provider;
    const rawOrder = [
      ...(preferredProvider ? [preferredProvider] : []),
      ...(configuredByAction ?? []),
      ...(configuredOrder ?? []),
      ...this.resolveAutoConnectedPriority(action),
      ...DEFAULT_PROVIDER_ORDER[action],
    ];
    const normalized: string[] = [];
    for (const entry of rawOrder) {
      const key = normalizeFinanceProviderId(entry);
      if (!key || normalized.includes(key)) {
        continue;
      }
      normalized.push(key);
    }
    return normalized;
  }

  private providerDebugTag(action: FinanceAction): string {
    return `${action}:${this.resolveProviderOrder(action).join(",")}`;
  }

  private async executeWithProviderFallback<T>(params: {
    action: FinanceAction;
    run: (provider: FinanceProvider) => Promise<T>;
    supports: (provider: FinanceProvider) => boolean;
  }): Promise<T> {
    const order = this.resolveProviderOrder(params.action);
    if (order.length === 0) {
      throw new Error(`No providers configured for ${params.action}`);
    }

    const failures: string[] = [];
    for (const providerId of order) {
      const provider = this.registry.get(providerId);
      if (!provider) {
        failures.push(`${providerId}: provider not registered`);
        continue;
      }
      if (!params.supports(provider)) {
        failures.push(`${providerId}: action not supported`);
        continue;
      }

      try {
        return await params.run(provider);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${provider.id}: ${message}`);
      }
    }

    throw new Error(
      `All providers failed for ${params.action}. Tried: ${order.join(", ")}. ${failures.join(
        " | ",
      )}`,
    );
  }

  async getMarketData(params: { symbol: string; timeframe?: string; limit?: number }) {
    const range = resolveYahooRange(params.timeframe);
    const symbol = normalizeYahooSymbol(params.symbol);
    const cacheKey = `${symbol}:${range.range}:${range.interval}:${this.providerDebugTag("market_data")}`;
    const cached = this.chartCache.get(cacheKey);
    if (cached) {
      return params.limit ? { ...cached, series: cached.series.slice(-params.limit) } : cached;
    }

    const series = await this.executeWithProviderFallback({
      action: "market_data",
      supports: (provider) => typeof provider.getMarketData === "function",
      run: async (provider) => {
        if (!provider.getMarketData) {
          throw new Error(`provider "${provider.id}" does not implement market_data`);
        }
        return await provider.getMarketData(
          { symbol, timeframe: params.timeframe, limit: params.limit },
          { profile: this.profile, config: this.config },
        );
      },
    });

    this.chartCache.set(cacheKey, series);
    return params.limit ? { ...series, series: series.series.slice(-params.limit) } : series;
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const normalized = symbols.map(normalizeYahooSymbol).filter(Boolean);
    const cacheKey = `${normalized.join(",")}:${this.providerDebugTag("quote")}`;
    const cached = this.quoteCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let quotes: Quote[];
    try {
      quotes = await this.executeWithProviderFallback({
        action: "quote",
        supports: (provider) => typeof provider.getQuotes === "function",
        run: async (provider) => {
          if (!provider.getQuotes) {
            throw new Error(`provider "${provider.id}" does not implement quote`);
          }
          const result = await provider.getQuotes(normalized, {
            profile: this.profile,
            config: this.config,
          });
          if (!Array.isArray(result) || result.length === 0) {
            throw new Error(`provider "${provider.id}" returned no quotes`);
          }
          return result;
        },
      });
    } catch (quoteError) {
      const fromSeries: Quote[] = [];
      const fallbackFailures: string[] = [];
      for (const symbol of normalized) {
        try {
          const series = await this.getMarketData({ symbol, timeframe: "6mo", limit: 2 });
          fromSeries.push(quoteFromSeries(series, symbol));
        } catch (fallbackError) {
          const message =
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          fallbackFailures.push(`${symbol}: ${message}`);
        }
      }
      if (fromSeries.length === normalized.length) {
        quotes = fromSeries;
      } else {
        const message = quoteError instanceof Error ? quoteError.message : String(quoteError);
        throw new Error(
          `Quote providers failed and market-data fallback was incomplete. ${message}. Fallback: ${fallbackFailures.join(" | ")}`,
          { cause: quoteError },
        );
      }
    }

    this.quoteCache.set(cacheKey, quotes);
    return quotes;
  }

  async getFundamentals(symbol: string): Promise<Fundamentals> {
    const normalized = normalizeYahooSymbol(symbol);
    const cacheKey = `${normalized}:${this.providerDebugTag("fundamentals")}`;
    const cached = this.fundamentalsCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const fundamentals = await this.executeWithProviderFallback({
        action: "fundamentals",
        supports: (provider) => typeof provider.getFundamentals === "function",
        run: async (provider) => {
          if (!provider.getFundamentals) {
            throw new Error(`provider "${provider.id}" does not implement fundamentals`);
          }
          return await provider.getFundamentals(normalized, {
            profile: this.profile,
            config: this.config,
          });
        },
      });
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
    const cacheKey = `${trimmed}:${params.locale ?? "US"}:${this.providerDebugTag("news")}`;
    const cached = this.newsCache.get(cacheKey);
    if (cached) {
      return params.limit ? cached.slice(0, params.limit) : cached;
    }

    const items = await this.executeWithProviderFallback({
      action: "news",
      supports: (provider) => typeof provider.getNews === "function",
      run: async (provider) => {
        if (!provider.getNews) {
          throw new Error(`provider "${provider.id}" does not implement news`);
        }
        return await provider.getNews(
          { query: trimmed, limit: params.limit, locale: params.locale },
          { profile: this.profile, config: this.config },
        );
      },
    });

    this.newsCache.set(cacheKey, items);
    return params.limit ? items.slice(0, params.limit) : items;
  }
}
