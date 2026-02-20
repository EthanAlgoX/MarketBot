/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * MarketBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with MarketBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { loadConfig } from "../../config/config.js";
import { resolveFetch } from "../../infra/fetch.js";
import { MarketDataClient } from "../../finance/client.js";
import { loadWatchlist, saveWatchlist } from "../../finance/watchlist-store.js";
import { loadDailyStockLast, saveDailyStockLast } from "../../finance/daily-stock-store.js";
import { runDailyStock, runStockReport } from "../../finance/daily-stock.js";
import { normalizeYahooSymbol } from "../../finance/yahoo.js";

const MAG7_SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA"] as const;
const DEFAULT_TIMEFRAME = "6mo";
const DEFAULT_NEWS_LIMIT = 5;
const DEFAULT_SERIES_LIMIT = 90;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") {
      continue;
    }
    const trimmed = v.trim();
    if (trimmed) {
      out.push(trimmed);
    }
  }
  return out;
}

function asProviderOrder(value: unknown): string[] | undefined {
  const arrayValue = asStringArray(value);
  if (arrayValue && arrayValue.length > 0) {
    return arrayValue;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : undefined;
}

function asPositiveInteger(value: unknown, fallback: number, max: number): number {
  const parsed = asNumber(value);
  if (parsed === undefined) {
    return fallback;
  }
  const rounded = Math.floor(parsed);
  if (!Number.isFinite(rounded) || rounded <= 0) {
    return fallback;
  }
  return Math.min(max, rounded);
}

function normalizeSymbols(value: unknown, fallback: readonly string[]): string[] {
  const fromRequest = asStringArray(value);
  const source = fromRequest && fromRequest.length > 0 ? fromRequest : Array.from(fallback);
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const symbol of source) {
    const normalized = normalizeYahooSymbol(symbol).trim().toUpperCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped.length > 0 ? deduped : Array.from(fallback);
}

function normalizePercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function formatIsoFromEpochMs(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const ms = value > 1_000_000_000_000 ? value : value * 1000;
  return new Date(ms).toISOString();
}

function sanitizeMarketDataMessage(message: string): string {
  return message.replace(/\bopenbb\b/gi, "connector");
}

function resolveOpenBbRuntime(config: ReturnType<typeof loadConfig>) {
  const raw = config.finance?.providers?.["openbb"];
  const envBaseUrl = process.env.OPENBB_BASE_URL?.trim();
  const baseUrl = raw?.baseUrl?.trim() || envBaseUrl || "";
  const timeoutMs =
    typeof raw?.timeoutMs === "number" && Number.isFinite(raw.timeoutMs) && raw.timeoutMs > 0
      ? raw.timeoutMs
      : 12_000;
  const provider = raw?.provider?.trim() || "yfinance";
  const apiKey = raw?.apiKey?.trim() || process.env.OPENBB_API_KEY?.trim() || undefined;
  const enabled = raw?.enabled === true || Boolean(baseUrl);
  return {
    enabled,
    baseUrl,
    provider,
    timeoutMs,
    apiKey,
  };
}

async function probeOpenBb(config: ReturnType<typeof loadConfig>) {
  const runtime = resolveOpenBbRuntime(config);
  if (!runtime.enabled || !runtime.baseUrl) {
    return {
      enabled: runtime.enabled,
      configured: Boolean(runtime.baseUrl),
      connected: false,
      baseUrl: runtime.baseUrl || null,
      provider: runtime.provider,
      error: null,
    };
  }
  const fetchImpl = resolveFetch();
  if (!fetchImpl) {
    return {
      enabled: runtime.enabled,
      configured: true,
      connected: false,
      baseUrl: runtime.baseUrl,
      provider: runtime.provider,
      error: "fetch is not available in this runtime",
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), runtime.timeoutMs);
  try {
    const url = new URL("equity/price/quote", `${runtime.baseUrl.replace(/\/+$/, "")}/`);
    url.searchParams.set("symbol", "AAPL");
    url.searchParams.set("provider", runtime.provider);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (runtime.apiKey) {
      headers.Authorization = `Bearer ${runtime.apiKey}`;
    }
    const response = await fetchImpl(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 200);
      return {
        enabled: runtime.enabled,
        configured: true,
        connected: false,
        baseUrl: runtime.baseUrl,
        provider: runtime.provider,
        error: sanitizeMarketDataMessage(`status=${response.status} ${body}`),
      };
    }
    return {
      enabled: runtime.enabled,
      configured: true,
      connected: true,
      baseUrl: runtime.baseUrl,
      provider: runtime.provider,
      error: null,
    };
  } catch (err) {
    return {
      enabled: runtime.enabled,
      configured: true,
      connected: false,
      baseUrl: runtime.baseUrl,
      provider: runtime.provider,
      error: sanitizeMarketDataMessage(String(err)),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const financeHandlers: GatewayRequestHandlers = {
  "finance.watchlist.get": async ({ respond }) => {
    const symbols = await loadWatchlist("default");
    respond(true, { name: "default", watchlist: symbols }, undefined);
  },

  "finance.watchlist.set": async ({ params, respond }) => {
    const raw = params as any;
    const list = asStringArray(raw?.watchlist);
    if (!list) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "invalid watchlist payload"),
      );
      return;
    }
    const saved = await saveWatchlist({ name: "default", symbols: list });
    respond(
      true,
      { name: saved.name, watchlist: saved.symbols, updatedAtIso: saved.updatedAtIso },
      undefined,
    );
  },

  "finance.daily.last": async ({ respond }) => {
    const last = await loadDailyStockLast();
    respond(true, { last }, undefined);
  },

  "finance.daily.run": async ({ params, respond }) => {
    const raw = params as any;
    const symbols = asStringArray(raw?.symbols);
    const watchlist = symbols && symbols.length > 0 ? symbols : await loadWatchlist("default");
    if (watchlist.length === 0) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "watchlist is empty"));
      return;
    }
    const timeframe = asString(raw?.timeframe) || undefined;
    const reportTypeRaw = asString(raw?.reportType).trim().toLowerCase();
    const reportType = reportTypeRaw === "full" ? "full" : "simple";
    const newsLimit = asNumber(raw?.newsLimit);
    const locale = asString(raw?.locale) || undefined;
    const includeFundamentals = asBoolean(raw?.includeFundamentals);
    const profile = asString(raw?.profile) || "marketbot";
    const provider = asString(raw?.provider) || undefined;
    const providerOrder = asProviderOrder(raw?.providerOrder);

    const result = await runDailyStock({
      symbols: watchlist,
      timeframe,
      reportType,
      newsLimit,
      locale,
      profile,
      provider,
      providerOrder,
      includeFundamentals: includeFundamentals ?? false,
    });
    await saveDailyStockLast(result).catch(() => undefined);
    respond(true, { result }, undefined);
  },

  "finance.report.run": async ({ params, respond }) => {
    const raw = params as any;
    const symbol = asString(raw?.symbol);
    if (!symbol.trim()) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "symbol required"));
      return;
    }
    const timeframe = asString(raw?.timeframe) || undefined;
    const reportTypeRaw = asString(raw?.reportType).trim().toLowerCase();
    const reportType = reportTypeRaw === "simple" ? "simple" : "full";
    const newsLimit = asNumber(raw?.newsLimit);
    const locale = asString(raw?.locale) || undefined;
    const includeFundamentals = asBoolean(raw?.includeFundamentals);
    const profile = asString(raw?.profile) || "marketbot";
    const provider = asString(raw?.provider) || undefined;
    const providerOrder = asProviderOrder(raw?.providerOrder);

    const result = await runStockReport({
      symbol,
      timeframe,
      reportType,
      newsLimit,
      locale,
      profile,
      provider,
      providerOrder,
      includeFundamentals: includeFundamentals ?? true,
    });
    respond(true, { result }, undefined);
  },

  "finance.market.status": async ({ respond }) => {
    const config = loadConfig();
    const openbb = await probeOpenBb(config);
    respond(
      true,
      {
        nowIso: new Date().toISOString(),
        engine: {
          name: "market-data",
          preferredProvider: "openbb",
          openbb,
        },
      },
      undefined,
    );
  },

  "finance.market.snapshot": async ({ params, respond }) => {
    const raw = params as any;
    const symbols = normalizeSymbols(raw?.symbols, MAG7_SYMBOLS);
    const timeframe = asString(raw?.timeframe).trim() || DEFAULT_TIMEFRAME;
    const locale = asString(raw?.locale).trim().toUpperCase() || "US";
    const newsLimit = asPositiveInteger(raw?.newsLimit, DEFAULT_NEWS_LIMIT, 20);
    const seriesLimit = asPositiveInteger(raw?.seriesLimit, DEFAULT_SERIES_LIMIT, 360);
    const includeFundamentals = asBoolean(raw?.includeFundamentals) ?? true;
    const provider = asString(raw?.provider).trim() || "openbb";
    const activeSymbolRaw = asString(raw?.activeSymbol).trim();
    const activeSymbolNormalized = activeSymbolRaw
      ? normalizeYahooSymbol(activeSymbolRaw).toUpperCase()
      : symbols[0];
    const activeSymbol = symbols.includes(activeSymbolNormalized)
      ? activeSymbolNormalized
      : symbols[0];

    const config = loadConfig();
    const client = new MarketDataClient({
      profile: "marketbot",
      config,
      provider,
    });

    const warnings: string[] = [];
    const quoteBySymbol = new Map<string, Awaited<ReturnType<MarketDataClient["getQuotes"]>>[0]>();
    try {
      const quoteRows = await client.getQuotes(symbols);
      for (const quote of quoteRows) {
        quoteBySymbol.set(normalizeYahooSymbol(quote.symbol).toUpperCase(), quote);
      }
    } catch (err) {
      warnings.push(sanitizeMarketDataMessage(`quotes unavailable: ${String(err)}`));
    }

    const items = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const series = await client.getMarketData({ symbol, timeframe, limit: seriesLimit });
          const quote = quoteBySymbol.get(symbol);
          return {
            symbol,
            source: series.source ?? "unknown",
            currency: quote?.currency ?? series.currency ?? null,
            exchange: quote?.exchange ?? series.exchange ?? null,
            price: typeof quote?.regularMarketPrice === "number" ? quote.regularMarketPrice : null,
            changePercent: normalizePercent(quote?.regularMarketChangePercent),
            marketTimeIso: formatIsoFromEpochMs(quote?.regularMarketTime),
            points: series.series
              .filter((point) => typeof point.close === "number")
              .map((point) => ({
                ts: point.ts,
                iso: point.iso,
                close: point.close as number,
              })),
            error: null,
          };
        } catch (err) {
          return {
            symbol,
            source: "unknown",
            currency: null,
            exchange: null,
            price: null,
            changePercent: null,
            marketTimeIso: null,
            points: [],
            error: sanitizeMarketDataMessage(String(err)),
          };
        }
      }),
    );

    const activeQuote = quoteBySymbol.get(activeSymbol);
    let news: Array<{ title: string; link: string; source?: string; pubDate?: string }> = [];
    if (newsLimit > 0) {
      try {
        news = await client.getNews({ query: activeSymbol, limit: newsLimit, locale });
      } catch (err) {
        warnings.push(sanitizeMarketDataMessage(`news unavailable: ${String(err)}`));
      }
    }

    let fundamentals:
      | {
          symbol: string;
          currency?: string;
          marketCap?: number;
          trailingPE?: number;
          forwardPE?: number;
          dividendYield?: number;
          payoutRatio?: number;
          epsTrailingTwelveMonths?: number;
          epsForward?: number;
          revenueTTM?: number;
          grossMargins?: number;
          operatingMargins?: number;
          profitMargins?: number;
          debtToEquity?: number;
          returnOnEquity?: number;
          freeCashflow?: number;
          targetMeanPrice?: number;
          sharesOutstanding?: number;
          beta?: number;
          lastFiscalYearEnd?: number;
          earningsQuarterlyGrowth?: number;
        }
      | { symbol: string } = { symbol: activeSymbol };
    if (includeFundamentals) {
      try {
        fundamentals = await client.getFundamentals(activeSymbol);
      } catch (err) {
        warnings.push(sanitizeMarketDataMessage(`fundamentals unavailable: ${String(err)}`));
      }
    }

    respond(
      true,
      {
        nowIso: new Date().toISOString(),
        symbols,
        timeframe,
        locale,
        provider,
        activeSymbol,
        activeQuote: {
          symbol: activeSymbol,
          price:
            typeof activeQuote?.regularMarketPrice === "number"
              ? activeQuote.regularMarketPrice
              : null,
          changePercent: normalizePercent(activeQuote?.regularMarketChangePercent),
          marketTimeIso: formatIsoFromEpochMs(activeQuote?.regularMarketTime),
        },
        items,
        news,
        fundamentals,
        warnings,
      },
      undefined,
    );
  },
};
