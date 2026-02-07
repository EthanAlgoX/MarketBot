/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import type { Fundamentals, MarketSeries, Quote } from "./types.js";

const KNOWN_CRYPTO = new Set([
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "XRP",
  "ADA",
  "AVAX",
  "DOGE",
  "DOT",
  "LTC",
  "LINK",
  "MATIC",
  "UNI",
]);

export function normalizeYahooSymbol(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase();
  if (!trimmed) {
    return symbol.trim();
  }
  if (trimmed.includes("/")) {
    return trimmed.replace("/", "-");
  }
  if (trimmed.startsWith("^") || trimmed.includes("=") || trimmed.includes("-")) {
    return trimmed;
  }
  if (KNOWN_CRYPTO.has(trimmed)) {
    return `${trimmed}-USD`;
  }
  if (/^[A-Z]{6}$/.test(trimmed)) {
    return `${trimmed}=X`;
  }
  return trimmed;
}

export function buildYahooChartUrl(params: {
  symbol: string;
  range: string;
  interval: string;
  includePrePost?: boolean;
}): string {
  const normalized = normalizeYahooSymbol(params.symbol);
  const q = new URLSearchParams();
  q.set("range", params.range);
  q.set("interval", params.interval);
  q.set("includePrePost", params.includePrePost ? "true" : "false");
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(normalized)}?${q.toString()}`;
}

export function buildYahooQuoteUrl(symbols: string[]): string {
  const normalized = symbols.map(normalizeYahooSymbol);
  const q = new URLSearchParams();
  q.set("symbols", normalized.join(","));
  return `https://query1.finance.yahoo.com/v7/finance/quote?${q.toString()}`;
}

export function buildYahooFundamentalsUrl(symbol: string): string {
  const normalized = normalizeYahooSymbol(symbol);
  const q = new URLSearchParams();
  q.set("modules", "summaryDetail,price,defaultKeyStatistics,financialData,earnings");
  return `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(normalized)}?${q.toString()}`;
}

export function parseYahooJsonFromText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Empty Yahoo response");
  }
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Yahoo response does not contain JSON");
  }
  const slice = trimmed.slice(start, end + 1);
  return JSON.parse(slice);
}

function unwrapNumber(value: any): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof value === "object" && typeof value.raw === "number") {
    return value.raw;
  }
  return undefined;
}

function unwrapString(value: any): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (value && typeof value === "object" && typeof value.fmt === "string") {
    const trimmed = value.fmt.trim();
    return trimmed ? trimmed : undefined;
  }
  return undefined;
}

export function parseYahooChart(json: any): MarketSeries {
  const result = json?.chart?.result?.[0];
  if (!result) {
    throw new Error("Yahoo chart response missing result");
  }
  const timestamps: number[] = Array.isArray(result.timestamp) ? result.timestamp : [];
  const indicators = result.indicators?.quote?.[0] ?? {};
  const opens: Array<number | null> = Array.isArray(indicators.open) ? indicators.open : [];
  const highs: Array<number | null> = Array.isArray(indicators.high) ? indicators.high : [];
  const lows: Array<number | null> = Array.isArray(indicators.low) ? indicators.low : [];
  const closes: Array<number | null> = Array.isArray(indicators.close) ? indicators.close : [];
  const volumes: Array<number | null> = Array.isArray(indicators.volume) ? indicators.volume : [];

  const series = timestamps.map((ts, idx) => ({
    ts: ts * 1000,
    iso: new Date(ts * 1000).toISOString(),
    open: opens[idx] ?? undefined,
    high: highs[idx] ?? undefined,
    low: lows[idx] ?? undefined,
    close: closes[idx] ?? undefined,
    volume: volumes[idx] ?? undefined,
  }));

  return {
    symbol: result.meta?.symbol ?? "UNKNOWN",
    source: "yahoo",
    currency: result.meta?.currency,
    exchange: result.meta?.exchangeName,
    timezone: result.meta?.timezone,
    regularMarketPrice: result.meta?.regularMarketPrice,
    regularMarketTime: result.meta?.regularMarketTime
      ? result.meta.regularMarketTime * 1000
      : undefined,
    series,
  };
}

export function parseYahooQuotes(json: any): Quote[] {
  const results = json?.quoteResponse?.result;
  if (!Array.isArray(results)) {
    return [];
  }
  return results.map((entry) => ({
    symbol: entry.symbol,
    shortName: entry.shortName ?? entry.longName,
    currency: entry.currency,
    exchange: entry.fullExchangeName ?? entry.exchange,
    regularMarketPrice: unwrapNumber(entry.regularMarketPrice),
    regularMarketChange: unwrapNumber(entry.regularMarketChange),
    regularMarketChangePercent: unwrapNumber(entry.regularMarketChangePercent),
    regularMarketTime: unwrapNumber(entry.regularMarketTime)
      ? unwrapNumber(entry.regularMarketTime)! * 1000
      : undefined,
    marketState: entry.marketState,
  }));
}

export function parseYahooFundamentals(json: any, symbol: string): Fundamentals {
  const result = json?.quoteSummary?.result?.[0];
  if (!result) {
    throw new Error("Yahoo fundamentals response missing result");
  }
  const summaryDetail = result.summaryDetail ?? {};
  const price = result.price ?? {};
  const stats = result.defaultKeyStatistics ?? {};
  const financial = result.financialData ?? {};

  return {
    symbol: symbol.toUpperCase(),
    currency: unwrapString(price.currency),
    marketCap: unwrapNumber(summaryDetail.marketCap),
    trailingPE: unwrapNumber(summaryDetail.trailingPE),
    forwardPE: unwrapNumber(summaryDetail.forwardPE),
    dividendYield: unwrapNumber(summaryDetail.dividendYield),
    payoutRatio: unwrapNumber(summaryDetail.payoutRatio),
    epsTrailingTwelveMonths: unwrapNumber(stats.trailingEps),
    epsForward: unwrapNumber(stats.forwardEps),
    revenueTTM: unwrapNumber(financial.totalRevenue),
    grossMargins: unwrapNumber(financial.grossMargins),
    operatingMargins: unwrapNumber(financial.operatingMargins),
    profitMargins: unwrapNumber(financial.profitMargins),
    debtToEquity: unwrapNumber(financial.debtToEquity),
    returnOnEquity: unwrapNumber(financial.returnOnEquity),
    freeCashflow: unwrapNumber(financial.freeCashflow),
    targetMeanPrice: unwrapNumber(financial.targetMeanPrice),
    sharesOutstanding: unwrapNumber(stats.sharesOutstanding),
    beta: unwrapNumber(stats.beta),
    lastFiscalYearEnd: unwrapNumber(stats.lastFiscalYearEnd)
      ? unwrapNumber(stats.lastFiscalYearEnd)! * 1000
      : undefined,
    earningsQuarterlyGrowth: unwrapNumber(financial.earningsQuarterlyGrowth),
  };
}
