/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import { resolveFetch } from "../infra/fetch.js";
import type { MarketBotConfig } from "../config/config.js";
import { fetchTextWithBrowser } from "./browser-client.js";
import { parseGoogleNewsRss } from "./news.js";
import { buildStooqDailyUrl, parseStooqDailyCsv, resolveStooqSymbol } from "./stooq.js";
import { resolveYahooRange } from "./timeframe.js";
import type { Fundamentals, MarketDataPoint, MarketSeries, NewsItem, Quote } from "./types.js";
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

export type FinanceProviderId = string;

export type FinanceMarketDataQuery = {
  symbol: string;
  timeframe?: string;
  limit?: number;
};

export type FinanceNewsQuery = {
  query: string;
  limit?: number;
  locale?: string;
};

export type FinanceProviderContext = {
  profile?: string;
  config?: MarketBotConfig;
};

export type FinanceProviderCapabilities = {
  marketData?: boolean;
  quotes?: boolean;
  fundamentals?: boolean;
  news?: boolean;
};

export type FinanceProvider = {
  id: FinanceProviderId;
  label: string;
  capabilities: FinanceProviderCapabilities;
  getMarketData?: (
    params: FinanceMarketDataQuery,
    ctx: FinanceProviderContext,
  ) => Promise<MarketSeries>;
  getQuotes?: (symbols: string[], ctx: FinanceProviderContext) => Promise<Quote[]>;
  getFundamentals?: (symbol: string, ctx: FinanceProviderContext) => Promise<Fundamentals>;
  getNews?: (params: FinanceNewsQuery, ctx: FinanceProviderContext) => Promise<NewsItem[]>;
};

export function normalizeFinanceProviderId(value: string): string {
  return value.trim().toLowerCase();
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (value && typeof value === "object") {
    const raw = (value as Record<string, unknown>).raw;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }
  }
  return undefined;
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickFirstNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toFiniteNumber(record[key]);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function pickFirstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = toNonEmptyString(record[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function parseTimestampMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    // OpenBB responses can be seconds or milliseconds.
    return value > 1_000_000_000_000 ? value : value * 1000;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function quoteFromSeries(series: MarketSeries): Quote {
  const points = series.series.filter((point) => typeof point.close === "number");
  const last = points.at(-1);
  if (!last || typeof last.close !== "number") {
    return {
      symbol: series.symbol,
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

function createYahooProvider(): FinanceProvider {
  return {
    id: "yahoo",
    label: "Yahoo Finance",
    capabilities: {
      marketData: true,
      quotes: true,
      fundamentals: true,
    },
    getMarketData: async (params, ctx) => {
      const range = resolveYahooRange(params.timeframe);
      const symbol = normalizeYahooSymbol(params.symbol);
      const url = buildYahooChartUrl({
        symbol,
        range: range.range,
        interval: range.interval,
        includePrePost: false,
      });
      const response = await fetchTextWithBrowser(url, {
        profile: ctx.profile,
        maxChars: 200000,
        retryMaxChars: 400000,
        content: "text",
      });
      const json = parseYahooJsonFromText(response.text);
      const parsed = parseYahooChart(json);
      return params.limit ? { ...parsed, series: parsed.series.slice(-params.limit) } : parsed;
    },
    getQuotes: async (symbols, ctx) => {
      const normalized = symbols.map(normalizeYahooSymbol).filter(Boolean);
      if (normalized.length === 0) {
        return [];
      }
      const url = buildYahooQuoteUrl(normalized);
      const response = await fetchTextWithBrowser(url, {
        profile: ctx.profile,
        maxChars: 120000,
        retryMaxChars: 240000,
        content: "text",
      });
      const json = parseYahooJsonFromText(response.text);
      const quotes = parseYahooQuotes(json);
      if (quotes.length === 0) {
        throw new Error("Yahoo quote API returned no results");
      }
      return quotes;
    },
    getFundamentals: async (symbol, ctx) => {
      const normalized = normalizeYahooSymbol(symbol);
      const url = buildYahooFundamentalsUrl(normalized);
      const response = await fetchTextWithBrowser(url, {
        profile: ctx.profile,
        maxChars: 200000,
        retryMaxChars: 400000,
        content: "text",
      });
      const json = parseYahooJsonFromText(response.text);
      return parseYahooFundamentals(json, normalized);
    },
  };
}

function createStooqProvider(): FinanceProvider {
  const fetchStooqSeries = async (
    params: FinanceMarketDataQuery,
    ctx: FinanceProviderContext,
  ): Promise<MarketSeries> => {
    const range = resolveYahooRange(params.timeframe);
    if (range.interval !== "1d") {
      throw new Error(`stooq does not support timeframe "${params.timeframe ?? "default"}"`);
    }
    const symbol = normalizeYahooSymbol(params.symbol);
    const stooqSymbol = resolveStooqSymbol(symbol);
    if (!stooqSymbol) {
      throw new Error(`stooq symbol mapping not available for "${params.symbol}"`);
    }
    const response = await fetchTextWithBrowser(buildStooqDailyUrl(stooqSymbol), {
      profile: ctx.profile,
      maxChars: 200000,
      content: "text",
    });
    const parsed = parseStooqDailyCsv(response.text, symbol);
    return params.limit ? { ...parsed, series: parsed.series.slice(-params.limit) } : parsed;
  };

  return {
    id: "stooq",
    label: "Stooq",
    capabilities: {
      marketData: true,
      quotes: true,
    },
    getMarketData: async (params, ctx) => await fetchStooqSeries(params, ctx),
    getQuotes: async (symbols, ctx) => {
      const quotes: Quote[] = [];
      for (const symbol of symbols) {
        const series = await fetchStooqSeries({ symbol, timeframe: "6mo", limit: 2 }, ctx);
        quotes.push(quoteFromSeries(series));
      }
      return quotes;
    },
  };
}

function createGoogleNewsProvider(): FinanceProvider {
  return {
    id: "google-news",
    label: "Google News",
    capabilities: {
      news: true,
    },
    getNews: async (params, ctx) => {
      const trimmed = params.query.trim();
      if (!trimmed) {
        throw new Error("news query required");
      }
      const locale = params.locale ?? "US";
      const query = new URLSearchParams();
      query.set("q", trimmed);
      query.set("hl", "en-US");
      query.set("gl", locale);
      query.set("ceid", `${locale}:en`);
      const url = `https://news.google.com/rss/search?${query.toString()}`;
      const response = await fetchTextWithBrowser(url, {
        profile: ctx.profile,
        maxChars: 200000,
        content: "text",
      });
      const items = parseGoogleNewsRss(response.text);
      return params.limit ? items.slice(0, params.limit) : items;
    },
  };
}

type AlpacaRuntimeConfig = {
  baseUrl: string;
  timeoutMs: number;
  apiKey: string;
  secretKey: string;
  feed: string;
  headers?: Record<string, string>;
};

function resolveAlpacaRuntimeConfig(config?: MarketBotConfig): AlpacaRuntimeConfig | null {
  const raw = config?.finance?.providers?.["alpaca"];
  if (raw?.enabled === false) {
    return null;
  }
  const envBaseUrl = process.env.ALPACA_BASE_URL?.trim();
  const baseUrl = raw?.baseUrl?.trim() || envBaseUrl || "https://data.alpaca.markets/v2";
  const apiKey = raw?.apiKey?.trim() || process.env.ALPACA_API_KEY?.trim() || "";
  const secretKey = raw?.secretKey?.trim() || process.env.ALPACA_SECRET_KEY?.trim() || "";
  const enabled =
    raw?.enabled === true ||
    Boolean(raw?.baseUrl?.trim()) ||
    Boolean(envBaseUrl) ||
    Boolean(apiKey && secretKey);
  if (!enabled || !apiKey || !secretKey) {
    return null;
  }
  const timeoutMs =
    typeof raw?.timeoutMs === "number" && Number.isFinite(raw.timeoutMs) && raw.timeoutMs > 0
      ? raw.timeoutMs
      : 10000;
  const feed = raw?.provider?.trim() || process.env.ALPACA_FEED?.trim() || "iex";
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    timeoutMs,
    apiKey,
    secretKey,
    feed,
    ...(raw?.headers ? { headers: raw.headers } : {}),
  };
}

function normalizeAlpacaSymbol(symbol: string): string | null {
  const normalized = normalizeYahooSymbol(symbol).toUpperCase();
  if (!normalized) {
    return null;
  }
  if (
    normalized.endsWith(".HK") ||
    normalized.endsWith(".SS") ||
    normalized.endsWith(".SZ") ||
    normalized.includes("=") ||
    normalized.includes("-") ||
    normalized.startsWith("^")
  ) {
    return null;
  }
  if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function estimateAlpacaLimit(timeframe?: string, limit?: number): number {
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return Math.min(Math.trunc(limit), 1000);
  }
  const range = resolveYahooRange(timeframe).range;
  const inferred =
    range === "1d"
      ? 2
      : range === "5d"
        ? 5
        : range === "1mo"
          ? 30
          : range === "3mo"
            ? 90
            : range === "6mo"
              ? 180
              : range === "1y"
                ? 365
                : range === "2y"
                  ? 730
                  : range === "5y"
                    ? 1000
                    : 250;
  return Math.min(Math.max(inferred, 2), 1000);
}

function estimateAlpacaLookbackDays(timeframe?: string, limit?: number): number {
  const range = resolveYahooRange(timeframe).range;
  const inferredDays =
    range === "1d"
      ? 7
      : range === "5d"
        ? 14
        : range === "1mo"
          ? 45
          : range === "3mo"
            ? 120
            : range === "6mo"
              ? 240
              : range === "1y"
                ? 420
                : range === "2y"
                  ? 840
                  : range === "5y"
                    ? 2100
                    : 3650;
  const inferredFromLimit =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? Math.max(Math.trunc(limit) * 3, 14)
      : 0;
  return Math.min(Math.max(inferredDays, inferredFromLimit, 7), 3650);
}

function buildAlpacaBarWindow(timeframe?: string, limit?: number): { start: string; end: string } {
  const now = Date.now();
  const lookbackDays = estimateAlpacaLookbackDays(timeframe, limit);
  const startMs = now - lookbackDays * 24 * 60 * 60 * 1000;
  // Include one extra day to avoid session boundary misses around market close.
  const endMs = now + 24 * 60 * 60 * 1000;
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  };
}

function extractAlpacaSnapshotMap(payload: unknown): Record<string, Record<string, unknown>> {
  const root = asRecord(payload);
  if (!root) {
    return {};
  }
  const snapshots = asRecord(root.snapshots);
  if (snapshots) {
    const out: Record<string, Record<string, unknown>> = {};
    for (const [key, value] of Object.entries(snapshots)) {
      const row = asRecord(value);
      if (row) {
        out[key] = row;
      }
    }
    return out;
  }
  const out: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(root)) {
    const row = asRecord(value);
    if (row) {
      out[key] = row;
    }
  }
  return out;
}

function parseAlpacaQuote(symbol: string, snapshot: Record<string, unknown>): Quote | null {
  const latestTrade = asRecord(snapshot.latestTrade);
  const dailyBar = asRecord(snapshot.dailyBar);
  const prevDailyBar = asRecord(snapshot.prevDailyBar);
  const regularMarketPrice =
    pickFirstNumber(latestTrade ?? {}, ["p", "price"]) ??
    pickFirstNumber(dailyBar ?? {}, ["c", "close"]);
  if (regularMarketPrice === undefined) {
    return null;
  }
  const prevClose = pickFirstNumber(prevDailyBar ?? {}, ["c", "close"]);
  const regularMarketChange = prevClose !== undefined ? regularMarketPrice - prevClose : undefined;
  const regularMarketChangePercent =
    prevClose !== undefined && prevClose !== 0 ? regularMarketChange! / prevClose : undefined;
  const regularMarketTime = parseTimestampMs(
    latestTrade?.t ?? dailyBar?.t ?? snapshot.timestamp ?? snapshot.updated,
  );
  return {
    symbol,
    currency: "USD",
    regularMarketPrice,
    ...(regularMarketChange !== undefined ? { regularMarketChange } : {}),
    ...(regularMarketChangePercent !== undefined ? { regularMarketChangePercent } : {}),
    ...(regularMarketTime ? { regularMarketTime } : {}),
    marketState: "REGULAR",
  };
}

async function alpacaGetJson(params: {
  runtime: AlpacaRuntimeConfig;
  path: string;
  query?: Record<string, string | number | undefined>;
}): Promise<unknown> {
  const fetchImpl = resolveFetch();
  if (!fetchImpl) {
    throw new Error("fetch is not available in this runtime");
  }
  const url = new URL(params.path.replace(/^\/+/, ""), `${params.runtime.baseUrl}/`);
  for (const [key, value] of Object.entries(params.query ?? {})) {
    if (value === undefined) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.runtime.timeoutMs);
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "APCA-API-KEY-ID": params.runtime.apiKey,
      "APCA-API-SECRET-KEY": params.runtime.secretKey,
      ...params.runtime.headers,
    };
    const response = await fetchImpl(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new Error(`alpaca request failed (${response.status}): ${body}`);
    }
    const text = await response.text();
    if (!text.trim()) {
      throw new Error("alpaca response was empty");
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

function createAlpacaProvider(runtime: AlpacaRuntimeConfig): FinanceProvider {
  return {
    id: "alpaca",
    label: "Alpaca",
    capabilities: {
      marketData: true,
      quotes: true,
    },
    getMarketData: async (params) => {
      const symbol = normalizeAlpacaSymbol(params.symbol);
      if (!symbol) {
        throw new Error(`alpaca supports US equities only: "${params.symbol}"`);
      }
      const limit = estimateAlpacaLimit(params.timeframe, params.limit);
      const window = buildAlpacaBarWindow(params.timeframe, params.limit);
      const payload = await alpacaGetJson({
        runtime,
        path: `/stocks/${encodeURIComponent(symbol)}/bars`,
        query: {
          timeframe: "1Day",
          limit,
          start: window.start,
          end: window.end,
          adjustment: "raw",
          feed: runtime.feed,
          sort: "desc",
        },
      });
      const root = asRecord(payload);
      const bars = Array.isArray(root?.bars) ? root?.bars : [];
      const points: MarketDataPoint[] = [];
      for (const row of bars) {
        const record = asRecord(row);
        if (!record) {
          continue;
        }
        const ts = parseTimestampMs(record.t);
        if (!ts) {
          continue;
        }
        points.push({
          ts,
          iso: new Date(ts).toISOString(),
          open: pickFirstNumber(record, ["o", "open"]),
          high: pickFirstNumber(record, ["h", "high"]),
          low: pickFirstNumber(record, ["l", "low"]),
          close: pickFirstNumber(record, ["c", "close"]),
          volume: pickFirstNumber(record, ["v", "volume"]),
        });
      }
      points.sort((a, b) => a.ts - b.ts);
      if (points.length === 0) {
        throw new Error(`alpaca bars response had no parseable rows for "${symbol}"`);
      }
      const last = points.at(-1);
      return {
        symbol,
        source: "alpaca",
        currency: "USD",
        ...(last?.close !== undefined ? { regularMarketPrice: last.close } : {}),
        ...(last?.ts ? { regularMarketTime: last.ts } : {}),
        series: params.limit ? points.slice(-params.limit) : points,
      };
    },
    getQuotes: async (symbols) => {
      const normalized = Array.from(
        new Set(
          symbols
            .map((symbol) => normalizeAlpacaSymbol(symbol))
            .filter((symbol): symbol is string => Boolean(symbol)),
        ),
      );
      if (normalized.length === 0) {
        throw new Error("alpaca supports US equities only");
      }
      const bySymbol = new Map<string, Quote>();
      for (let i = 0; i < normalized.length; i += 50) {
        const batch = normalized.slice(i, i + 50);
        const payload = await alpacaGetJson({
          runtime,
          path: "/stocks/snapshots",
          query: {
            symbols: batch.join(","),
            feed: runtime.feed,
          },
        });
        const snapshots = extractAlpacaSnapshotMap(payload);
        for (const symbol of batch) {
          const snapshot = asRecord(snapshots[symbol]);
          if (!snapshot) {
            continue;
          }
          const quote = parseAlpacaQuote(symbol, snapshot);
          if (quote) {
            bySymbol.set(symbol, quote);
          }
        }
      }
      const quotes = normalized
        .map((symbol) => bySymbol.get(symbol))
        .filter((q): q is Quote => !!q);
      if (quotes.length === 0) {
        throw new Error("alpaca quote response had no parseable rows");
      }
      return quotes;
    },
  };
}

type OpenBbRuntimeConfig = {
  baseUrl: string;
  provider: string;
  providerByAction?: Partial<Record<OpenBbAction, string>>;
  timeoutMs: number;
  apiKey?: string;
  headers?: Record<string, string>;
};

type OpenBbAction = "market_data" | "quote" | "fundamentals" | "news";

function resolveOpenBbRuntimeConfig(config?: MarketBotConfig): OpenBbRuntimeConfig | null {
  const raw = config?.finance?.providers?.["openbb"];
  if (raw?.enabled === false) {
    return null;
  }
  const envBaseUrl = process.env.OPENBB_BASE_URL?.trim();
  const baseUrl = raw?.baseUrl?.trim() || envBaseUrl || "http://127.0.0.1:6900/api/v1";
  const enabled = raw?.enabled === true || Boolean(raw?.baseUrl?.trim()) || Boolean(envBaseUrl);
  if (!enabled) {
    return null;
  }
  const timeoutMs =
    typeof raw?.timeoutMs === "number" && Number.isFinite(raw.timeoutMs) && raw.timeoutMs > 0
      ? raw.timeoutMs
      : 15000;
  const provider = raw?.provider?.trim() || "yfinance";
  const providerByAction = {
    ...(raw?.providerByAction?.market_data?.trim()
      ? { market_data: raw.providerByAction.market_data.trim() }
      : {}),
    ...(raw?.providerByAction?.quote?.trim() ? { quote: raw.providerByAction.quote.trim() } : {}),
    ...(raw?.providerByAction?.fundamentals?.trim()
      ? { fundamentals: raw.providerByAction.fundamentals.trim() }
      : {}),
    ...(raw?.providerByAction?.news?.trim() ? { news: raw.providerByAction.news.trim() } : {}),
  } satisfies Partial<Record<OpenBbAction, string>>;
  const apiKey = raw?.apiKey?.trim() || process.env.OPENBB_API_KEY?.trim() || undefined;
  const headers = raw?.headers;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    provider,
    ...(Object.keys(providerByAction).length > 0 ? { providerByAction } : {}),
    timeoutMs,
    ...(apiKey ? { apiKey } : {}),
    ...(headers ? { headers } : {}),
  };
}

function extractOpenBbRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter((entry) => asRecord(entry) !== null) as Array<Record<string, unknown>>;
  }
  const asObject = asRecord(payload);
  if (!asObject) {
    return [];
  }
  const candidates = [asObject.results, asObject.data, asObject.items];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((entry) => asRecord(entry) !== null) as Array<
        Record<string, unknown>
      >;
    }
  }
  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (record) {
      return [record];
    }
  }
  return [asObject];
}

function normalizeOpenBbPercent(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Math.abs(value) > 1 ? value / 100 : value;
}

function parseOpenBbQuoteRow(row: Record<string, unknown>, fallbackSymbol: string): Quote {
  const price = pickFirstNumber(row, ["price", "last_price", "last", "close"]);
  const change = pickFirstNumber(row, ["change", "regular_market_change"]);
  const rawChangePercent = pickFirstNumber(row, [
    "change_percent",
    "change_pct",
    "regular_market_change_percent",
  ]);
  const regularMarketTime = parseTimestampMs(row.updated ?? row.timestamp ?? row.time ?? row.date);

  return {
    symbol:
      pickFirstString(row, ["symbol", "ticker", "Symbol"]) ??
      normalizeYahooSymbol(fallbackSymbol).toUpperCase(),
    shortName: pickFirstString(row, ["name", "short_name", "shortName"]),
    currency: pickFirstString(row, ["currency", "Currency"]),
    exchange: pickFirstString(row, ["exchange", "Exchange"]),
    regularMarketPrice: price,
    regularMarketChange: change,
    regularMarketChangePercent: normalizeOpenBbPercent(rawChangePercent),
    regularMarketTime,
    marketState: pickFirstString(row, ["market_state", "marketState"]),
  };
}

function extractOpenBbNewsItems(rows: Array<Record<string, unknown>>): NewsItem[] {
  const items: NewsItem[] = [];
  for (const row of rows) {
    const title = pickFirstString(row, ["title", "headline", "name"]);
    const link = pickFirstString(row, ["url", "link", "article_url", "source_url"]);
    if (!title || !link) {
      continue;
    }
    const source = pickFirstString(row, ["source", "source_name", "publisher", "site"]);
    const parsedDate = parseTimestampMs(
      row.date ?? row.datetime ?? row.published ?? row.published_at ?? row.updated_at ?? row.time,
    );
    const fallbackDate = pickFirstString(row, [
      "date",
      "datetime",
      "published",
      "published_at",
      "updated_at",
      "time",
    ]);
    items.push({
      title,
      link,
      ...(source ? { source } : {}),
      ...(parsedDate
        ? { pubDate: new Date(parsedDate).toISOString() }
        : fallbackDate
          ? { pubDate: fallbackDate }
          : {}),
    });
  }
  return items;
}

function normalizeSymbolListFromQuery(query: string): string[] {
  const candidates = query
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.toUpperCase())
    .filter((entry) => /^[A-Z0-9.-]{1,12}$/.test(entry));
  return Array.from(new Set(candidates));
}

function toPositiveInteger(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  const parsed = Math.trunc(value);
  return parsed > 0 ? parsed : undefined;
}

function unknownErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "unknown error";
}

function resolveOpenBbProviderForAction(
  runtime: OpenBbRuntimeConfig,
  action: OpenBbAction,
): string {
  const byAction = runtime.providerByAction?.[action]?.trim();
  return byAction && byAction.length > 0 ? byAction : runtime.provider;
}

function mapOpenBbFundamentals(row: Record<string, unknown>, fallbackSymbol: string): Fundamentals {
  const lastFiscalYearEnd = parseTimestampMs(
    row.fiscal_year_end ?? row.last_fiscal_year_end ?? row.report_date,
  );
  return {
    symbol:
      pickFirstString(row, ["symbol", "ticker", "Symbol"]) ??
      normalizeYahooSymbol(fallbackSymbol).toUpperCase(),
    currency: pickFirstString(row, ["currency", "Currency"]),
    marketCap: pickFirstNumber(row, ["market_cap", "marketCap", "market_capitalization"]),
    trailingPE: pickFirstNumber(row, ["pe", "pe_ratio", "trailing_pe", "trailingPE"]),
    forwardPE: pickFirstNumber(row, ["forward_pe", "forwardPE", "forward_pe_ratio"]),
    dividendYield: normalizeOpenBbPercent(
      pickFirstNumber(row, ["dividend_yield", "trailing_dividend_yield", "dividendYield"]),
    ),
    payoutRatio: normalizeOpenBbPercent(
      pickFirstNumber(row, ["payout_ratio", "payoutRatio", "dividend_payout_ratio"]),
    ),
    epsTrailingTwelveMonths: pickFirstNumber(row, ["eps", "eps_ttm", "trailing_eps"]),
    epsForward: pickFirstNumber(row, ["eps_forward", "forward_eps", "eps_estimate"]),
    revenueTTM: pickFirstNumber(row, ["revenue_ttm", "revenue", "total_revenue"]),
    grossMargins: normalizeOpenBbPercent(
      pickFirstNumber(row, ["gross_margin", "gross_margins", "grossProfitMargin"]),
    ),
    operatingMargins: normalizeOpenBbPercent(
      pickFirstNumber(row, ["operating_margin", "operating_margins", "operatingProfitMargin"]),
    ),
    profitMargins: normalizeOpenBbPercent(
      pickFirstNumber(row, ["net_margin", "profit_margin", "profit_margins", "netProfitMargin"]),
    ),
    debtToEquity: pickFirstNumber(row, ["debt_to_equity", "debtToEquity"]),
    returnOnEquity: normalizeOpenBbPercent(
      pickFirstNumber(row, ["return_on_equity", "roe", "returnOnEquity"]),
    ),
    freeCashflow: pickFirstNumber(row, ["free_cash_flow", "free_cashflow", "freeCashFlow"]),
    targetMeanPrice: pickFirstNumber(row, ["target_mean_price", "target_price", "targetPrice"]),
    sharesOutstanding: pickFirstNumber(row, ["shares_outstanding", "sharesOutstanding"]),
    beta: pickFirstNumber(row, ["beta", "beta_1y"]),
    ...(lastFiscalYearEnd ? { lastFiscalYearEnd } : {}),
    earningsQuarterlyGrowth: normalizeOpenBbPercent(
      pickFirstNumber(row, ["earnings_growth_quarterly", "earnings_growth", "earningsGrowth"]),
    ),
  };
}

function pickOpenBbQuoteRowForSymbol(
  rows: Array<Record<string, unknown>>,
  symbol: string,
): Record<string, unknown> | undefined {
  const normalizedSymbol = normalizeYahooSymbol(symbol).toUpperCase();
  const index = rows.findIndex((row) => {
    const rowSymbol = pickFirstString(row, ["symbol", "ticker", "Symbol"]);
    return rowSymbol ? normalizeYahooSymbol(rowSymbol).toUpperCase() === normalizedSymbol : false;
  });
  if (index >= 0) {
    return rows.splice(index, 1)[0];
  }
  return rows.shift();
}

function buildOpenBbNewsWorldQuery(params: {
  runtime: OpenBbRuntimeConfig;
  query: string;
  limit?: number;
}): Record<string, string | number | undefined> {
  return {
    provider: resolveOpenBbProviderForAction(params.runtime, "news"),
    ...(params.limit ? { limit: params.limit } : {}),
    ...(params.query ? { term: params.query } : {}),
  };
}

function buildOpenBbNewsCompanyQuery(params: {
  runtime: OpenBbRuntimeConfig;
  symbolQuery: string;
  limit?: number;
}): Record<string, string | number | undefined> {
  return {
    provider: resolveOpenBbProviderForAction(params.runtime, "news"),
    symbol: params.symbolQuery,
    ...(params.limit ? { limit: params.limit } : {}),
  };
}

async function fetchOpenBbCompanyNews(params: {
  runtime: OpenBbRuntimeConfig;
  symbolQuery: string;
  limit?: number;
}): Promise<NewsItem[]> {
  const payload = await openBbGetJson({
    runtime: params.runtime,
    path: "/news/company",
    query: buildOpenBbNewsCompanyQuery(params),
  });
  const rows = extractOpenBbRows(payload);
  const items = extractOpenBbNewsItems(rows);
  return params.limit ? items.slice(0, params.limit) : items;
}

async function fetchOpenBbWorldNews(params: {
  runtime: OpenBbRuntimeConfig;
  query: string;
  limit?: number;
}): Promise<NewsItem[]> {
  const payload = await openBbGetJson({
    runtime: params.runtime,
    path: "/news/world",
    query: buildOpenBbNewsWorldQuery(params),
  });
  const rows = extractOpenBbRows(payload);
  const items = extractOpenBbNewsItems(rows);
  return params.limit ? items.slice(0, params.limit) : items;
}

async function openBbGetJson(params: {
  runtime: OpenBbRuntimeConfig;
  path: string;
  query?: Record<string, string | number | undefined>;
}): Promise<unknown> {
  const fetchImpl = resolveFetch();
  if (!fetchImpl) {
    throw new Error("fetch is not available in this runtime");
  }

  const url = new URL(params.path.replace(/^\/+/, ""), `${params.runtime.baseUrl}/`);
  for (const [key, value] of Object.entries(params.query ?? {})) {
    if (value === undefined) {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.runtime.timeoutMs);
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...params.runtime.headers,
    };
    if (params.runtime.apiKey && !headers.Authorization) {
      headers.Authorization = `Bearer ${params.runtime.apiKey}`;
    }
    const response = await fetchImpl(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new Error(`openbb request failed (${response.status}): ${body}`);
    }
    const text = await response.text();
    if (!text.trim()) {
      throw new Error("openbb response was empty");
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

function createOpenBbProvider(runtime: OpenBbRuntimeConfig): FinanceProvider {
  return {
    id: "openbb",
    label: "OpenBB",
    capabilities: {
      marketData: true,
      quotes: true,
      fundamentals: true,
      news: true,
    },
    getMarketData: async (params) => {
      const range = resolveYahooRange(params.timeframe);
      const payload = await openBbGetJson({
        runtime,
        path: "/equity/price/historical",
        query: {
          symbol: normalizeYahooSymbol(params.symbol),
          provider: resolveOpenBbProviderForAction(runtime, "market_data"),
          interval: range.interval,
        },
      });
      const rows = extractOpenBbRows(payload);
      if (rows.length === 0) {
        throw new Error("openbb historical response had no rows");
      }

      const points: MarketDataPoint[] = [];
      for (const row of rows) {
        const ts = parseTimestampMs(
          row.date ?? row.datetime ?? row.timestamp ?? row.time ?? row.report_date,
        );
        if (!ts) {
          continue;
        }
        points.push({
          ts,
          iso: new Date(ts).toISOString(),
          open: pickFirstNumber(row, ["open", "Open"]),
          high: pickFirstNumber(row, ["high", "High"]),
          low: pickFirstNumber(row, ["low", "Low"]),
          close: pickFirstNumber(row, ["close", "Close", "last", "price"]),
          volume: pickFirstNumber(row, ["volume", "Volume"]),
        });
      }
      points.sort((a, b) => a.ts - b.ts);
      if (points.length === 0) {
        throw new Error("openbb historical rows were not parseable");
      }

      const first = rows[0] ?? {};
      const symbol =
        pickFirstString(first, ["symbol", "ticker", "Symbol"]) ??
        normalizeYahooSymbol(params.symbol).toUpperCase();
      const series: MarketSeries = {
        symbol,
        source: "openbb",
        currency: pickFirstString(first, ["currency", "Currency"]),
        exchange: pickFirstString(first, ["exchange", "Exchange"]),
        series: params.limit ? points.slice(-params.limit) : points,
      };
      return series;
    },
    getQuotes: async (symbols) => {
      const normalized = symbols.map(normalizeYahooSymbol).filter(Boolean);
      if (normalized.length === 0) {
        return [];
      }
      const payload = await openBbGetJson({
        runtime,
        path: "/equity/price/quote",
        query: {
          symbol: normalized.join(","),
          provider: resolveOpenBbProviderForAction(runtime, "quote"),
        },
      });
      const rows = extractOpenBbRows(payload);
      if (rows.length === 0) {
        throw new Error("openbb quote response had no rows");
      }

      const remaining = [...rows];
      const quotes: Quote[] = [];
      for (const symbol of normalized) {
        const row = pickOpenBbQuoteRowForSymbol(remaining, symbol);
        if (!row) {
          continue;
        }
        quotes.push(parseOpenBbQuoteRow(row, symbol));
      }
      if (quotes.length === 0) {
        throw new Error("openbb quote rows were not parseable");
      }
      return quotes;
    },
    getFundamentals: async (symbol) => {
      const normalized = normalizeYahooSymbol(symbol);
      const payload = await openBbGetJson({
        runtime,
        path: "/equity/fundamental/metrics",
        query: {
          symbol: normalized,
          provider: resolveOpenBbProviderForAction(runtime, "fundamentals"),
          limit: 1,
        },
      });
      const rows = extractOpenBbRows(payload);
      const row = rows[0];
      if (!row) {
        throw new Error(`openbb fundamentals response was empty for "${symbol}"`);
      }
      return mapOpenBbFundamentals(row, normalized);
    },
    getNews: async (params) => {
      const query = params.query.trim();
      if (!query) {
        throw new Error("news query required");
      }
      const limit = toPositiveInteger(params.limit);
      const symbols = normalizeSymbolListFromQuery(query);
      const symbolQuery = symbols.length > 0 ? symbols.join(",") : "";

      let companyError: unknown;
      if (symbolQuery) {
        try {
          const companyNews = await fetchOpenBbCompanyNews({
            runtime,
            symbolQuery,
            limit,
          });
          if (companyNews.length > 0) {
            return companyNews;
          }
        } catch (error) {
          companyError = error;
        }
      }

      try {
        const worldNews = await fetchOpenBbWorldNews({
          runtime,
          query,
          limit,
        });
        if (worldNews.length > 0) {
          return worldNews;
        }
      } catch (worldError) {
        const worldMessage = unknownErrorMessage(worldError);
        if (companyError) {
          const companyMessage = unknownErrorMessage(companyError);
          throw new Error(
            `openbb news requests failed. company: ${companyMessage}; world: ${worldMessage}`,
            { cause: worldError },
          );
        }
        throw worldError;
      }

      if (companyError) {
        throw companyError;
      }
      throw new Error(`openbb news returned no items for query "${query}"`);
    },
  };
}

export function createFinanceProviderRegistry(
  config?: MarketBotConfig,
): Map<string, FinanceProvider> {
  const registry = new Map<string, FinanceProvider>();

  const providers: FinanceProvider[] = [
    createYahooProvider(),
    createStooqProvider(),
    createGoogleNewsProvider(),
  ];
  const alpaca = resolveAlpacaRuntimeConfig(config);
  if (alpaca) {
    providers.push(createAlpacaProvider(alpaca));
  }
  const openbb = resolveOpenBbRuntimeConfig(config);
  if (openbb) {
    providers.push(createOpenBbProvider(openbb));
  }

  for (const provider of providers) {
    registry.set(normalizeFinanceProviderId(provider.id), provider);
  }

  return registry;
}
