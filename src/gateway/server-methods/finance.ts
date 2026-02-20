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
import type { Quote } from "../../finance/types.js";

const MAG7_SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA"] as const;
const DEFAULT_TIMEFRAME = "6mo";
const DEFAULT_NEWS_LIMIT = 5;
const DEFAULT_SERIES_LIMIT = 90;
const DEFAULT_TOP_MOVERS_LIMIT = 10;
const DEFAULT_REASON_NEWS_LIMIT = 4;
const FLOW_DEFAULT_PROVIDER_ORDER = ["openbb", "yahoo", "stooq", "google-news"] as const;

type FlowAssetClass = "usStocks" | "hkStocks" | "aStocks" | "metals" | "crypto";

const FLOW_CLASS_LABELS: Record<FlowAssetClass, string> = {
  usStocks: "US Equities Top Gainers",
  hkStocks: "Hong Kong Equities Top Gainers",
  aStocks: "A-Shares Top Gainers",
  metals: "Metals Top Gainers",
  crypto: "Crypto Top Gainers",
};
const FLOW_DEFAULT_ASSET_CLASSES: FlowAssetClass[] = [
  "usStocks",
  "hkStocks",
  "aStocks",
  "metals",
  "crypto",
];

const FLOW_UNIVERSES: Record<FlowAssetClass, readonly string[]> = {
  usStocks: [
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "GOOGL",
    "META",
    "TSLA",
    "AVGO",
    "AMD",
    "NFLX",
    "PLTR",
    "SMCI",
    "ORCL",
    "CRM",
    "ADBE",
    "INTC",
    "JPM",
    "GS",
    "V",
    "MA",
    "XOM",
    "CVX",
    "UBER",
    "SHOP",
    "COIN",
    "SNOW",
    "PANW",
    "CRWD",
    "ARM",
    "TSM",
  ],
  hkStocks: [
    "00700.HK",
    "09988.HK",
    "03690.HK",
    "01810.HK",
    "09618.HK",
    "00981.HK",
    "00388.HK",
    "01398.HK",
    "02318.HK",
    "01299.HK",
    "00005.HK",
    "02015.HK",
    "01109.HK",
    "02269.HK",
    "01024.HK",
    "09868.HK",
    "09999.HK",
    "06862.HK",
    "00883.HK",
    "02382.HK",
  ],
  aStocks: [
    "600519.SS",
    "601318.SS",
    "600036.SS",
    "600900.SS",
    "601899.SS",
    "601857.SS",
    "600276.SS",
    "600309.SS",
    "600030.SS",
    "600031.SS",
    "600941.SS",
    "002594.SZ",
    "000333.SZ",
    "000858.SZ",
    "000651.SZ",
    "300750.SZ",
    "300760.SZ",
    "002415.SZ",
    "002371.SZ",
    "000725.SZ",
  ],
  metals: ["GC=F", "SI=F", "PL=F", "PA=F", "HG=F", "GLD", "SLV", "PPLT", "CPER", "GDX"],
  crypto: [
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
  ],
};

const FLOW_OVERVIEW_SYMBOLS = [
  "QQQ",
  "SPY",
  "IWM",
  "HYG",
  "TLT",
  "UUP",
  "^VIX",
  "GLD",
  "BTC-USD",
  "USDJPY=X",
] as const;

type FlowDirection = "inflow" | "outflow" | "neutral";

type FlowOverviewMetric = {
  key: string;
  label: string;
  symbol: string;
  price: number | null;
  changePercent: number | null;
  direction: FlowDirection;
};

type FlowAssetFlow = {
  asset: "equities" | "metals" | "crypto";
  label: string;
  changePercent: number | null;
  direction: FlowDirection;
};

type FlowTopMover = {
  symbol: string;
  name: string | null;
  price: number | null;
  changePercent: number | null;
  currency: string | null;
  exchange: string | null;
  marketTimeIso: string | null;
  reason: string;
  headline: string | null;
};

type FlowDataQuality = {
  providerOrder: string[];
  metricCoveragePercent: number | null;
  moverCoveragePercent: number | null;
  metricAvailable: number;
  metricTotal: number;
  moverRowsAvailable: number;
  moverRowsRequested: number;
};

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

function asFlowAssetClasses(value: unknown): FlowAssetClass[] | null {
  const raw = asStringArray(value);
  if (!raw || raw.length === 0) {
    return null;
  }
  const out: FlowAssetClass[] = [];
  const seen = new Set<FlowAssetClass>();
  for (const item of raw) {
    if (
      item !== "usStocks" &&
      item !== "hkStocks" &&
      item !== "aStocks" &&
      item !== "metals" &&
      item !== "crypto"
    ) {
      continue;
    }
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    out.push(item);
  }
  return out.length > 0 ? out : null;
}

function resolveFlowProviderOrder(value: unknown): string[] {
  const parsed = asProviderOrder(value);
  if (parsed && parsed.length > 0) {
    return parsed;
  }
  return Array.from(FLOW_DEFAULT_PROVIDER_ORDER);
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

function normalizeFlowDirection(changePercent: number | null, threshold = 0.2): FlowDirection {
  if (typeof changePercent !== "number" || !Number.isFinite(changePercent)) {
    return "neutral";
  }
  if (changePercent > threshold) {
    return "inflow";
  }
  if (changePercent < -threshold) {
    return "outflow";
  }
  return "neutral";
}

function sanitizeHeadline(headline: string | null | undefined): string | null {
  if (!headline) {
    return null;
  }
  const normalized = headline.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  return normalized.length > 140 ? `${normalized.slice(0, 137)}...` : normalized;
}

function fallbackReason(assetClass: FlowAssetClass, changePercent: number | null): string {
  const direction = normalizeFlowDirection(changePercent);
  if (assetClass === "metals") {
    if (direction === "inflow") {
      return "贵金属走强，偏向通胀与避险交易。";
    }
    if (direction === "outflow") {
      return "贵金属回落，避险交易阶段性降温。";
    }
    return "贵金属窄幅波动，资金等待新的宏观催化。";
  }
  if (assetClass === "crypto") {
    if (direction === "inflow") {
      return "加密资产动量抬升，风险偏好回暖。";
    }
    if (direction === "outflow") {
      return "加密资产承压，短线风险偏好走弱。";
    }
    return "加密资产横盘，增量资金观望。";
  }
  if (direction === "inflow") {
    return "板块内强势轮动，短线资金净流入。";
  }
  if (direction === "outflow") {
    return "短线获利了结，资金流入放缓。";
  }
  return "震荡上行，资金面暂无单一主线。";
}

function formatTopMoverReason(
  assetClass: FlowAssetClass,
  headline: string | null,
  changePercent: number | null,
) {
  if (headline) {
    return `新闻驱动：${headline}`;
  }
  return fallbackReason(assetClass, changePercent);
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeTrendDirection(changePercent: number | null): "up" | "down" | "sideways" {
  if (typeof changePercent !== "number" || !Number.isFinite(changePercent)) {
    return "sideways";
  }
  if (changePercent > 0.6) {
    return "up";
  }
  if (changePercent < -0.6) {
    return "down";
  }
  return "sideways";
}

function computeStdDev(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - avg) * (value - avg), 0) / values.length;
  return Number.isFinite(variance) ? Math.sqrt(variance) : null;
}

function inferAssetClassFromSymbol(symbol: string): FlowAssetClass {
  const upper = symbol.toUpperCase();
  if (upper.endsWith(".HK")) {
    return "hkStocks";
  }
  if (upper.endsWith(".SS") || upper.endsWith(".SZ")) {
    return "aStocks";
  }
  if (upper.endsWith("-USD")) {
    return "crypto";
  }
  if (FLOW_UNIVERSES.metals.some((item) => normalizeYahooSymbol(item) === upper)) {
    return "metals";
  }
  if (upper.includes("=F")) {
    return "metals";
  }
  return "usStocks";
}

function quoteFromSeriesFallback(
  series: {
    symbol: string;
    currency?: string;
    exchange?: string;
    regularMarketPrice?: number;
    regularMarketTime?: number;
    series: Array<{ ts: number; close?: number }>;
  },
  fallbackSymbol: string,
): Quote {
  const points = series.series.filter((point) => typeof point.close === "number");
  const last = points.at(-1);
  const symbol = normalizeYahooSymbol(series.symbol || fallbackSymbol).toUpperCase();
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

async function fetchQuotesWithApiFallback(params: {
  client: MarketDataClient;
  symbols: string[];
  fallbackTimeframe: string;
  fallbackLimit: number;
  warningPrefix: string;
}): Promise<{ bySymbol: Map<string, Quote>; warnings: string[] }> {
  const warnings: string[] = [];
  const normalizedSymbols = normalizeSymbols(params.symbols, params.symbols);
  const bySymbol = new Map<string, Quote>();

  try {
    const quotes = await params.client.getQuotes(normalizedSymbols);
    for (const quote of quotes) {
      const symbol = normalizeYahooSymbol(quote.symbol).toUpperCase();
      if (!symbol) continue;
      bySymbol.set(symbol, quote);
    }
  } catch (err) {
    warnings.push(sanitizeMarketDataMessage(`${params.warningPrefix}: ${String(err)}`));
  }

  const missing = normalizedSymbols.filter((symbol) => !bySymbol.has(symbol));
  if (missing.length === 0) {
    return { bySymbol, warnings };
  }

  await Promise.all(
    missing.map(async (symbol) => {
      try {
        const series = await params.client.getMarketData({
          symbol,
          timeframe: params.fallbackTimeframe,
          limit: params.fallbackLimit,
        });
        const quote = quoteFromSeriesFallback(series, symbol);
        bySymbol.set(symbol, quote);
      } catch (err) {
        warnings.push(
          sanitizeMarketDataMessage(
            `${params.warningPrefix} (${symbol}) fallback failed: ${String(err)}`,
          ),
        );
      }
    }),
  );

  return { bySymbol, warnings };
}

async function buildFlowOverview(params: { client: MarketDataClient }): Promise<{
  asOfIso: string;
  liquidityRegime: "risk-on" | "risk-off" | "balanced";
  summary: string;
  fedSignal: string;
  bojSignal: string;
  metrics: FlowOverviewMetric[];
  assetFlows: FlowAssetFlow[];
  warnings: string[];
}> {
  const quoteResult = await fetchQuotesWithApiFallback({
    client: params.client,
    symbols: Array.from(FLOW_OVERVIEW_SYMBOLS),
    fallbackTimeframe: "6mo",
    fallbackLimit: 5,
    warningPrefix: "overview quotes unavailable",
  });
  const warnings: string[] = [...quoteResult.warnings];
  const bySymbol = new Map<string, Quote>();
  for (const [symbol, quote] of quoteResult.bySymbol.entries()) {
    bySymbol.set(symbol, quote);
  }
  const metricDefs = [
    { key: "qqq", label: "US Growth (QQQ)", symbol: "QQQ" },
    { key: "hyg", label: "Credit (HYG)", symbol: "HYG" },
    { key: "tlt", label: "US Duration (TLT)", symbol: "TLT" },
    { key: "uup", label: "US Dollar (UUP)", symbol: "UUP" },
    { key: "vix", label: "Volatility (^VIX)", symbol: "^VIX" },
    { key: "usdjpy", label: "USDJPY", symbol: "USDJPY=X" },
  ] as const;
  const metrics: FlowOverviewMetric[] = metricDefs.map((metric) => {
    const quote = bySymbol.get(metric.symbol);
    const changePercent = normalizePercent(quote?.regularMarketChangePercent);
    return {
      key: metric.key,
      label: metric.label,
      symbol: metric.symbol,
      price: numeric(quote?.regularMarketPrice),
      changePercent,
      direction: normalizeFlowDirection(changePercent),
    };
  });

  const qqq = metrics.find((metric) => metric.key === "qqq")?.changePercent ?? null;
  const hyg = metrics.find((metric) => metric.key === "hyg")?.changePercent ?? null;
  const tlt = metrics.find((metric) => metric.key === "tlt")?.changePercent ?? null;
  const uup = metrics.find((metric) => metric.key === "uup")?.changePercent ?? null;
  const vix = metrics.find((metric) => metric.key === "vix")?.changePercent ?? null;
  const usdjpy = metrics.find((metric) => metric.key === "usdjpy")?.changePercent ?? null;

  const gld = normalizePercent(bySymbol.get("GLD")?.regularMarketChangePercent);
  const btc = normalizePercent(bySymbol.get("BTC-USD")?.regularMarketChangePercent);
  const spy = normalizePercent(bySymbol.get("SPY")?.regularMarketChangePercent);

  let riskScore = 0;
  if (typeof qqq === "number" && qqq > 0) {
    riskScore += 1;
  }
  if (typeof hyg === "number" && hyg > 0) {
    riskScore += 1;
  }
  if (typeof tlt === "number" && tlt > 0) {
    riskScore += 1;
  }
  if (typeof uup === "number" && uup > 0) {
    riskScore -= 1;
  }
  if (typeof vix === "number" && vix > 0) {
    riskScore -= 1;
  }
  if (typeof usdjpy === "number" && usdjpy < 0) {
    riskScore -= 1;
  }

  const liquidityRegime = riskScore >= 2 ? "risk-on" : riskScore <= -2 ? "risk-off" : "balanced";
  const summary =
    liquidityRegime === "risk-on"
      ? "全球流动性偏宽松，风险资产获得边际增量资金。"
      : liquidityRegime === "risk-off"
        ? "全球流动性偏收紧，资金转向防御与低波动资产。"
        : "全球流动性处于均衡区间，资金在风险与防御之间轮动。";
  const fedSignal =
    typeof tlt === "number" && tlt > 0.4
      ? "美债久期资产走强，市场更偏向定价美联储后续宽松。"
      : typeof tlt === "number" && tlt < -0.4
        ? "美债久期资产回落，市场对美联储宽松节奏预期降温。"
        : "美债久期资产波动有限，美联储路径预期暂无明确单边。";
  const bojSignal =
    typeof usdjpy === "number" && usdjpy < -0.35
      ? "美元兑日元走弱，日元偏强，市场倾向定价日本更偏紧政策。"
      : typeof usdjpy === "number" && usdjpy > 0.35
        ? "美元兑日元走强，日元偏弱，日本政策收紧交易暂未强化。"
        : "美元兑日元波动平稳，日本政策对全球流动性的扰动有限。";

  const assetFlows: FlowAssetFlow[] = [
    {
      asset: "equities",
      label: "Equities",
      changePercent:
        typeof qqq === "number" && typeof spy === "number" ? (qqq + spy) / 2 : (qqq ?? spy),
      direction: normalizeFlowDirection(
        typeof qqq === "number" && typeof spy === "number" ? (qqq + spy) / 2 : (qqq ?? spy),
      ),
    },
    {
      asset: "metals",
      label: "Metals",
      changePercent: gld,
      direction: normalizeFlowDirection(gld),
    },
    {
      asset: "crypto",
      label: "Crypto",
      changePercent: btc,
      direction: normalizeFlowDirection(btc),
    },
  ];

  return {
    asOfIso: new Date().toISOString(),
    liquidityRegime,
    summary,
    fedSignal,
    bojSignal,
    metrics,
    assetFlows,
    warnings,
  };
}

async function buildTopMoversForClass(params: {
  client: MarketDataClient;
  assetClass: FlowAssetClass;
  topN: number;
  locale: string;
  reasonNewsLimit: number;
}): Promise<{
  assetClass: FlowAssetClass;
  label: string;
  items: FlowTopMover[];
  warnings: string[];
}> {
  const symbols = normalizeSymbols(
    FLOW_UNIVERSES[params.assetClass],
    FLOW_UNIVERSES[params.assetClass],
  );
  const quoteResult = await fetchQuotesWithApiFallback({
    client: params.client,
    symbols,
    fallbackTimeframe: "1mo",
    fallbackLimit: 6,
    warningPrefix: `${params.assetClass} quotes unavailable`,
  });
  const warnings: string[] = [...quoteResult.warnings];

  const rows = Array.from(quoteResult.bySymbol.values())
    .map((quote) => {
      const normalizedSymbol = normalizeYahooSymbol(quote.symbol).toUpperCase();
      return {
        symbol: normalizedSymbol,
        name:
          typeof quote.shortName === "string" && quote.shortName.trim()
            ? quote.shortName.trim()
            : null,
        price: numeric(quote.regularMarketPrice),
        changePercent: normalizePercent(quote.regularMarketChangePercent),
        currency:
          typeof quote.currency === "string" && quote.currency.trim()
            ? quote.currency.trim()
            : null,
        exchange:
          typeof quote.exchange === "string" && quote.exchange.trim()
            ? quote.exchange.trim()
            : null,
        marketTimeIso: formatIsoFromEpochMs(quote.regularMarketTime),
      };
    })
    .filter((row) => typeof row.changePercent === "number")
    .toSorted((a, b) => (b.changePercent as number) - (a.changePercent as number))
    .slice(0, params.topN);

  const headlineBySymbol = new Map<string, string>();
  const reasonSymbols = rows.slice(0, params.reasonNewsLimit).map((row) => row.symbol);
  await Promise.all(
    reasonSymbols.map(async (symbol) => {
      try {
        const news = await params.client.getNews({
          query: symbol,
          limit: 1,
          locale: params.locale,
        });
        const headline = sanitizeHeadline(news[0]?.title);
        if (headline) {
          headlineBySymbol.set(symbol, headline);
        }
      } catch {
        // Reason fallback is deterministic and avoids failing the whole panel.
      }
    }),
  );

  return {
    assetClass: params.assetClass,
    label: FLOW_CLASS_LABELS[params.assetClass],
    items: rows.map((row) => {
      const headline = headlineBySymbol.get(row.symbol) ?? null;
      return {
        ...row,
        reason: formatTopMoverReason(params.assetClass, headline, row.changePercent),
        headline,
      };
    }),
    warnings,
  };
}

async function buildFlowDetail(params: {
  client: MarketDataClient;
  symbol: string;
  locale: string;
  assetClass: FlowAssetClass;
}): Promise<{
  symbol: string;
  assetClass: FlowAssetClass;
  nowIso: string;
  price: number | null;
  changePercent: number | null;
  marketTimeIso: string | null;
  points: Array<{ ts: number; iso: string; close: number }>;
  analysis: {
    trend: "up" | "down" | "sideways";
    changePercent7d: number | null;
    volatilityPercent: number | null;
    summary: string;
  };
  news: Array<{ title: string; link: string; source?: string; pubDate?: string }>;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const normalizedSymbol = normalizeYahooSymbol(params.symbol).toUpperCase();
  const [quotes, series] = await Promise.all([
    params.client.getQuotes([normalizedSymbol]).catch((err) => {
      warnings.push(sanitizeMarketDataMessage(`detail quote unavailable: ${String(err)}`));
      return [] as Quote[];
    }),
    params.client
      .getMarketData({ symbol: normalizedSymbol, timeframe: "1mo", limit: 30 })
      .catch((err) => {
        warnings.push(sanitizeMarketDataMessage(`detail series unavailable: ${String(err)}`));
        return { symbol: normalizedSymbol, source: "unknown" as const, series: [] };
      }),
  ]);

  const detailPoints = series.series
    .filter((point) => typeof point.close === "number")
    .map((point) => ({
      ts: point.ts,
      iso: point.iso,
      close: point.close as number,
    }))
    .slice(-7);

  const quote = quotes.find(
    (item) => normalizeYahooSymbol(item.symbol).toUpperCase() === normalizedSymbol,
  );
  const price = numeric(quote?.regularMarketPrice);
  const changePercent = normalizePercent(quote?.regularMarketChangePercent);
  const marketTimeIso = formatIsoFromEpochMs(quote?.regularMarketTime);

  let news: Array<{ title: string; link: string; source?: string; pubDate?: string }> = [];
  try {
    news = await params.client.getNews({
      query: normalizedSymbol,
      limit: 3,
      locale: params.locale,
    });
  } catch (err) {
    warnings.push(sanitizeMarketDataMessage(`detail news unavailable: ${String(err)}`));
  }

  let changePercent7d: number | null = null;
  if (detailPoints.length >= 2) {
    const start = detailPoints[0]?.close ?? 0;
    const end = detailPoints.at(-1)?.close ?? 0;
    if (Number.isFinite(start) && start !== 0 && Number.isFinite(end)) {
      changePercent7d = ((end - start) / start) * 100;
    }
  }
  const returns = detailPoints
    .slice(1)
    .map((point, index) => {
      const prev = detailPoints[index]?.close ?? 0;
      if (!Number.isFinite(prev) || prev === 0) {
        return null;
      }
      return ((point.close - prev) / prev) * 100;
    })
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const volatilityPercent = computeStdDev(returns);
  const trend = normalizeTrendDirection(changePercent7d);
  const trendText =
    trend === "up"
      ? "最近 7 天趋势向上。"
      : trend === "down"
        ? "最近 7 天趋势向下。"
        : "最近 7 天主要震荡。";
  const volText =
    typeof volatilityPercent === "number" && volatilityPercent > 2
      ? "波动偏高，仓位与止损需要更保守。"
      : "波动可控，节奏以跟随趋势为主。";
  const headline = sanitizeHeadline(news[0]?.title);
  const summary = headline
    ? `${trendText}${volText} 近期催化：${headline}`
    : `${trendText}${volText}`;

  return {
    symbol: normalizedSymbol,
    assetClass: params.assetClass,
    nowIso: new Date().toISOString(),
    price,
    changePercent,
    marketTimeIso,
    points: detailPoints,
    analysis: {
      trend,
      changePercent7d,
      volatilityPercent,
      summary,
    },
    news,
    warnings,
  };
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

  "finance.flow.snapshot": async ({ params, respond }) => {
    const raw = params as any;
    const topN = asPositiveInteger(raw?.topN, DEFAULT_TOP_MOVERS_LIMIT, 20);
    const locale = asString(raw?.locale).trim().toUpperCase() || "US";
    const provider = asString(raw?.provider).trim() || "openbb";
    const providerOrder = resolveFlowProviderOrder(raw?.providerOrder);
    const reasonNewsLimit = asPositiveInteger(raw?.reasonNewsLimit, DEFAULT_REASON_NEWS_LIMIT, 10);
    const assetClasses = asFlowAssetClasses(raw?.assetClasses) ?? FLOW_DEFAULT_ASSET_CLASSES;

    const config = loadConfig();
    const client = new MarketDataClient({
      profile: "marketbot",
      config,
      provider,
      providerOrder,
    });

    const overview = await buildFlowOverview({ client });
    const buckets = await Promise.all(
      assetClasses.map((assetClass) =>
        buildTopMoversForClass({
          client,
          assetClass,
          topN,
          locale,
          reasonNewsLimit,
        }),
      ),
    );
    const warnings = [...overview.warnings, ...buckets.flatMap((bucket) => bucket.warnings)];
    const metricTotal = overview.metrics.length;
    const metricAvailable = overview.metrics.filter(
      (metric) => typeof metric.changePercent === "number" && Number.isFinite(metric.changePercent),
    ).length;
    const moverRowsRequested = topN * buckets.length;
    const moverRowsAvailable = buckets.reduce((sum, bucket) => sum + bucket.items.length, 0);
    const dataQuality: FlowDataQuality = {
      providerOrder,
      metricCoveragePercent:
        metricTotal > 0 ? Number(((metricAvailable / metricTotal) * 100).toFixed(1)) : null,
      moverCoveragePercent:
        moverRowsRequested > 0
          ? Number(((moverRowsAvailable / moverRowsRequested) * 100).toFixed(1))
          : null,
      metricAvailable,
      metricTotal,
      moverRowsAvailable,
      moverRowsRequested,
    };

    respond(
      true,
      {
        nowIso: new Date().toISOString(),
        provider,
        providerOrder,
        locale,
        topN,
        overview: {
          asOfIso: overview.asOfIso,
          liquidityRegime: overview.liquidityRegime,
          summary: overview.summary,
          fedSignal: overview.fedSignal,
          bojSignal: overview.bojSignal,
          metrics: overview.metrics,
          assetFlows: overview.assetFlows,
        },
        buckets: buckets.map((bucket) => ({
          assetClass: bucket.assetClass,
          label: bucket.label,
          items: bucket.items,
        })),
        dataQuality,
        warnings,
      },
      undefined,
    );
  },

  "finance.flow.detail": async ({ params, respond }) => {
    const raw = params as any;
    const symbolInput = asString(raw?.symbol).trim();
    if (!symbolInput) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "symbol required"));
      return;
    }
    const locale = asString(raw?.locale).trim().toUpperCase() || "US";
    const provider = asString(raw?.provider).trim() || "openbb";
    const providerOrder = resolveFlowProviderOrder(raw?.providerOrder);
    const requestedAssetClass = asString(raw?.assetClass).trim();
    const normalizedSymbol = normalizeYahooSymbol(symbolInput).toUpperCase();
    const assetClass: FlowAssetClass =
      requestedAssetClass === "usStocks" ||
      requestedAssetClass === "hkStocks" ||
      requestedAssetClass === "aStocks" ||
      requestedAssetClass === "metals" ||
      requestedAssetClass === "crypto"
        ? requestedAssetClass
        : inferAssetClassFromSymbol(normalizedSymbol);

    const config = loadConfig();
    const client = new MarketDataClient({
      profile: "marketbot",
      config,
      provider,
      providerOrder,
    });
    const detail = await buildFlowDetail({
      client,
      symbol: normalizedSymbol,
      locale,
      assetClass,
    });
    respond(true, detail, undefined);
  },
};
