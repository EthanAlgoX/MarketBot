/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import {
  type AnyAgentTool,
  jsonResult,
  readNumberParam,
  readStringArrayParam,
  readStringParam,
} from "./common.js";
import { FinanceToolSchema } from "./finance-tool.schema.js";
import type { MarketBotConfig } from "../../config/config.js";
import { MarketDataClient } from "../../finance/client.js";
import { analyzeRisk, analyzeTechnicals } from "../../finance/analysis.js";
import { buildPortfolioOverview } from "../../finance/portfolio.js";
import type { MarketSeries, PortfolioPosition } from "../../finance/types.js";
import { buildComparison } from "../../finance/compare.js";
import { buildFinanceBrief } from "../../finance/brief.js";
import { buildPortfolioRisk } from "../../finance/portfolio-risk.js";
import { buildPortfolioOptimization } from "../../finance/optimize.js";

function splitSymbolTokens(value: string): string[] {
  return value
    .split(/[\s,，;；|]+/g)
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);
}

function readSymbolList(params: Record<string, unknown>): string[] {
  const symbols = new Set<string>();

  const direct = readStringArrayParam(params, "symbols");
  if (Array.isArray(direct)) {
    for (const entry of direct) {
      for (const token of splitSymbolTokens(entry)) {
        symbols.add(token);
      }
    }
  }

  const single = readStringParam(params, "symbol");
  if (single) {
    for (const token of splitSymbolTokens(single)) {
      symbols.add(token);
    }
  }

  return [...symbols];
}

function coerceMarketSeries(input: unknown): MarketSeries | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const obj = input as Record<string, unknown>;
  if (!Array.isArray(obj.series)) {
    return null;
  }
  return {
    symbol: typeof obj.symbol === "string" ? obj.symbol : "UNKNOWN",
    source: (obj.source as "yahoo" | "openbb" | "unknown") ?? "unknown",
    currency: typeof obj.currency === "string" ? obj.currency : undefined,
    exchange: typeof obj.exchange === "string" ? obj.exchange : undefined,
    timezone: typeof obj.timezone === "string" ? obj.timezone : undefined,
    regularMarketPrice:
      typeof obj.regularMarketPrice === "number" ? obj.regularMarketPrice : undefined,
    regularMarketTime:
      typeof obj.regularMarketTime === "number" ? obj.regularMarketTime : undefined,
    series: obj.series as MarketSeries["series"],
  };
}

function parseClosePoint(point: unknown): { label: string; close: number } | null {
  if (!point || typeof point !== "object") {
    return null;
  }
  const record = point as Record<string, unknown>;
  const closeRaw = record.close;
  const close =
    typeof closeRaw === "number"
      ? closeRaw
      : typeof closeRaw === "string"
        ? Number.parseFloat(closeRaw)
        : Number.NaN;
  if (!Number.isFinite(close) || close <= 0) {
    return null;
  }
  const isoRaw = typeof record.iso === "string" ? record.iso : undefined;
  const tsRaw = typeof record.ts === "number" ? record.ts : undefined;
  const label = isoRaw
    ? isoRaw.slice(0, 10)
    : tsRaw
      ? new Date(tsRaw).toISOString().slice(0, 10)
      : "";
  if (!label) {
    return null;
  }
  return { label, close };
}

function buildIndexedMermaidChart(params: {
  symbols: string[];
  seriesList: Array<{ symbol: string; series: unknown[] }>;
}) {
  const normalizedPerSymbol = new Map<string, Array<{ label: string; value: number }>>();
  for (const symbol of params.symbols) {
    const series = params.seriesList.find((entry) => entry.symbol.toUpperCase() === symbol)?.series;
    if (!Array.isArray(series)) {
      continue;
    }
    const parsed = series
      .map(parseClosePoint)
      .filter((entry): entry is { label: string; close: number } => Boolean(entry));
    if (parsed.length < 2) {
      continue;
    }
    const anchor = parsed[0]?.close;
    if (!anchor || !Number.isFinite(anchor) || anchor <= 0) {
      continue;
    }
    normalizedPerSymbol.set(
      symbol,
      parsed.map((entry) => ({
        label: entry.label,
        value: Number(((entry.close / anchor) * 100).toFixed(2)),
      })),
    );
  }

  const availableSymbols = params.symbols.filter((symbol) => normalizedPerSymbol.has(symbol));
  if (availableSymbols.length === 0) {
    return {
      mermaid: "",
      points: [] as Array<{ date: string; values: Record<string, number> }>,
      symbols: [] as string[],
      yMin: 0,
      yMax: 0,
    };
  }

  const minLen = Math.min(
    ...availableSymbols.map((symbol) => normalizedPerSymbol.get(symbol)?.length ?? 0),
  );
  if (!Number.isFinite(minLen) || minLen < 2) {
    return {
      mermaid: "",
      points: [] as Array<{ date: string; values: Record<string, number> }>,
      symbols: [] as string[],
      yMin: 0,
      yMax: 0,
    };
  }

  const alignedSymbols = availableSymbols;
  const aligned = alignedSymbols.map((symbol) => {
    const rows = normalizedPerSymbol.get(symbol) ?? [];
    return {
      symbol,
      rows: rows.slice(rows.length - minLen),
    };
  });
  const labels = aligned[0]?.rows.map((row) => row.label) ?? [];
  const points: Array<{ date: string; values: Record<string, number> }> = labels.map(
    (label, idx) => ({
      date: label,
      values: Object.fromEntries(
        aligned.map((entry) => [entry.symbol, Number(entry.rows[idx]?.value ?? 0)]),
      ),
    }),
  );

  const values = aligned.flatMap((entry) => entry.rows.map((row) => row.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const yMin = Math.max(0, Math.floor(min - 5));
  const yMax = Math.ceil(max + 5);

  const xAxis = `[${labels.map((label) => `"${label.slice(5)}"`).join(", ")}]`;
  const lines = aligned.map(
    (entry) => `  line "${entry.symbol}" [${entry.rows.map((row) => row.value).join(", ")}]`,
  );
  const mermaid = [
    "xychart-beta",
    '  title "Indexed Performance (Start = 100)"',
    `  x-axis ${xAxis}`,
    `  y-axis "Index" ${yMin} --> ${yMax}`,
    ...lines,
  ].join("\n");

  return {
    mermaid,
    points,
    symbols: alignedSymbols,
    yMin,
    yMax,
  };
}

export function createFinanceTool(options?: { config?: MarketBotConfig }): AnyAgentTool {
  return {
    label: "Finance",
    name: "finance",
    description:
      "Fetch market data via the MarketBot browser, compute technicals/risk, fundamentals, compare symbols, build a news-driven brief, and summarize/analyze portfolios.",
    parameters: FinanceToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const profile = readStringParam(params, "profile") ?? "marketbot";
      const provider = readStringParam(params, "provider");
      const providerOrder = readStringArrayParam(params, "providerOrder");
      const client = new MarketDataClient({
        profile,
        ...(provider ? { provider } : {}),
        ...(providerOrder && providerOrder.length > 0 ? { providerOrder } : {}),
        ...(options?.config ? { config: options.config } : {}),
      });

      switch (action) {
        case "market_data": {
          const symbols = readSymbolList(params);
          if (symbols.length === 0) {
            throw new Error("symbol required");
          }
          const timeframe = readStringParam(params, "timeframe");
          const limit = readNumberParam(params, "limit", { integer: true });
          if (symbols.length === 1) {
            const series = await client.getMarketData({ symbol: symbols[0], timeframe, limit });
            return jsonResult(series);
          }
          const series = await Promise.all(
            symbols.map((symbol) => client.getMarketData({ symbol, timeframe, limit })),
          );
          return jsonResult({ symbols, series });
        }
        case "quote": {
          const symbols = readSymbolList(params);
          if (symbols.length === 0) {
            throw new Error("symbols required");
          }
          const quotes = await client.getQuotes(symbols);
          return jsonResult({ symbols, quotes });
        }
        case "fundamentals": {
          const symbol = readStringParam(params, "symbol", { required: true });
          const fundamentals = await client.getFundamentals(symbol);
          return jsonResult(fundamentals);
        }
        case "technicals": {
          const timeframe = readStringParam(params, "timeframe");
          const dataInput = params.data;
          const coerced = coerceMarketSeries(dataInput);
          const series =
            coerced ??
            (await client.getMarketData({
              symbol: readStringParam(params, "symbol", { required: true }),
              timeframe,
            }));
          const summary = analyzeTechnicals(series, timeframe);
          return jsonResult(summary);
        }
        case "risk": {
          const timeframe = readStringParam(params, "timeframe");
          const dataInput = params.data;
          const coerced = coerceMarketSeries(dataInput);
          const series =
            coerced ??
            (await client.getMarketData({
              symbol: readStringParam(params, "symbol", { required: true }),
              timeframe,
            }));
          const summary = analyzeRisk(series, timeframe);
          return jsonResult(summary);
        }
        case "summary": {
          const symbol = readStringParam(params, "symbol", { required: true });
          const timeframe = readStringParam(params, "timeframe");
          const series = await client.getMarketData({ symbol, timeframe });
          const technicals = analyzeTechnicals(series, timeframe);
          const risk = analyzeRisk(series, timeframe);
          const fundamentals = await client.getFundamentals(symbol);
          const quotes = await client.getQuotes([symbol]);
          return jsonResult({
            series,
            technicals,
            risk,
            fundamentals,
            quote: quotes[0],
          });
        }
        case "portfolio": {
          const positionsRaw = params.positions;
          if (!Array.isArray(positionsRaw) || positionsRaw.length === 0) {
            throw new Error("positions required");
          }
          const positions = positionsRaw.map((entry) => {
            const obj = entry as Record<string, unknown>;
            const symbol = typeof obj.symbol === "string" ? obj.symbol : "";
            const quantity = typeof obj.quantity === "number" ? obj.quantity : Number.NaN;
            const costBasis = typeof obj.costBasis === "number" ? obj.costBasis : undefined;
            if (!symbol || Number.isNaN(quantity)) {
              throw new Error("positions require symbol and quantity");
            }
            return { symbol, quantity, costBasis } as PortfolioPosition;
          });
          const quotes = await client.getQuotes(positions.map((p) => p.symbol));
          const overview = buildPortfolioOverview(positions, quotes);
          return jsonResult(overview);
        }
        case "portfolio_risk": {
          const positionsRaw = params.positions;
          const timeframe = readStringParam(params, "timeframe");
          const benchmarkSymbol = readStringParam(params, "benchmark");
          if (!Array.isArray(positionsRaw) || positionsRaw.length === 0) {
            throw new Error("positions required");
          }
          const positions = positionsRaw.map((entry) => {
            const obj = entry as Record<string, unknown>;
            const symbol = typeof obj.symbol === "string" ? obj.symbol : "";
            const quantity = typeof obj.quantity === "number" ? obj.quantity : Number.NaN;
            const costBasis = typeof obj.costBasis === "number" ? obj.costBasis : undefined;
            if (!symbol || Number.isNaN(quantity)) {
              throw new Error("positions require symbol and quantity");
            }
            return { symbol, quantity, costBasis } as PortfolioPosition;
          });

          const symbols = positions.map((p) => p.symbol);
          const quotes = await client.getQuotes(symbols);
          const overview = buildPortfolioOverview(positions, quotes);

          const weightsInput = params.weights;
          const weights = new Map<string, number>();
          if (weightsInput && typeof weightsInput === "object" && !Array.isArray(weightsInput)) {
            for (const [key, value] of Object.entries(weightsInput as Record<string, unknown>)) {
              if (typeof value === "number" && Number.isFinite(value)) {
                weights.set(key.toUpperCase(), value);
              }
            }
          }
          if (weights.size === 0) {
            const bySymbol = new Map(quotes.map((q) => [q.symbol.toUpperCase(), q]));
            const values: Array<{ symbol: string; value: number }> = [];
            for (const p of positions) {
              const q = bySymbol.get(p.symbol.toUpperCase());
              const price = q?.regularMarketPrice;
              const value = typeof price === "number" ? price * p.quantity : Number.NaN;
              if (Number.isFinite(value)) {
                values.push({ symbol: p.symbol.toUpperCase(), value });
              }
            }
            const total = values.reduce((acc, v) => acc + v.value, 0);
            if (total > 0) {
              for (const v of values) {
                weights.set(v.symbol, v.value / total);
              }
            } else {
              const w = 1 / Math.max(positions.length, 1);
              for (const p of positions) {
                weights.set(p.symbol.toUpperCase(), w);
              }
            }
          }

          const series = await Promise.all(
            symbols.map((symbol) => client.getMarketData({ symbol, timeframe })),
          );
          const seriesBySymbol = new Map(series.map((s) => [s.symbol.toUpperCase(), s]));
          const benchmark = benchmarkSymbol
            ? await client.getMarketData({ symbol: benchmarkSymbol, timeframe })
            : null;

          const risk = buildPortfolioRisk({
            seriesBySymbol,
            weights,
            timeframe,
            benchmark,
          });

          return jsonResult({ overview, risk });
        }
        case "optimize": {
          const symbols = readSymbolList(params);
          if (symbols.length < 2) {
            throw new Error("optimize requires at least 2 symbols");
          }
          const timeframe = readStringParam(params, "timeframe");
          const benchmarkSymbol = readStringParam(params, "benchmark");
          const series = await Promise.all(
            symbols.map((symbol) => client.getMarketData({ symbol, timeframe })),
          );
          const seriesBySymbol = new Map(series.map((s) => [s.symbol.toUpperCase(), s]));
          const benchmark = benchmarkSymbol
            ? await client.getMarketData({ symbol: benchmarkSymbol, timeframe })
            : null;
          const result = buildPortfolioOptimization({
            seriesBySymbol,
            symbols,
            timeframe,
            benchmark,
          });
          return jsonResult(result);
        }
        case "news": {
          // Models sometimes provide `symbol` when asking for asset-related news.
          // Accept `symbol` as a fallback to keep the tool forgiving.
          const symbol = readStringParam(params, "symbol");
          const query = readStringParam(params, "query") ?? symbol ?? "";
          if (!query.trim()) {
            throw new Error("news requires query or symbol");
          }
          const limit = readNumberParam(params, "limit", { integer: true });
          const locale = readStringParam(params, "locale");
          const items = await client.getNews({ query, limit, locale });
          return jsonResult({ query, items });
        }
        case "compare": {
          const symbols = readSymbolList(params);
          if (symbols.length < 2) {
            throw new Error("compare requires at least 2 symbols");
          }
          const timeframe = readStringParam(params, "timeframe");
          const benchmarkSymbol = readStringParam(params, "benchmark");
          const series = await Promise.all(
            symbols.map((symbol) => client.getMarketData({ symbol, timeframe })),
          );
          const benchmark = benchmarkSymbol
            ? await client.getMarketData({ symbol: benchmarkSymbol, timeframe })
            : null;
          const result = buildComparison({ series, timeframe, benchmark });
          return jsonResult(result);
        }
        case "brief": {
          const timeframe = readStringParam(params, "timeframe");
          const limit = readNumberParam(params, "limit", { integer: true }) ?? 10;
          const locale = readStringParam(params, "locale");
          const symbol = readStringParam(params, "symbol");
          const query = readStringParam(params, "query") ?? symbol ?? "";
          if (!query.trim()) {
            throw new Error("brief requires symbol or query");
          }
          const items = await client.getNews({ query, limit, locale });
          if (!symbol) {
            return jsonResult(buildFinanceBrief({ query, items, timeframe }));
          }
          const [quote] = await client.getQuotes([symbol]);
          const series = await client.getMarketData({ symbol, timeframe });
          const technicals = analyzeTechnicals(series, timeframe);
          const risk = analyzeRisk(series, timeframe);
          const fundamentals = await client.getFundamentals(symbol);
          return jsonResult(
            buildFinanceBrief({
              query,
              items,
              symbol,
              timeframe,
              quote,
              fundamentals,
              technicals,
              risk,
            }),
          );
        }
        case "chart": {
          const symbols = readSymbolList(params);
          if (symbols.length === 0) {
            throw new Error("chart requires symbol(s)");
          }
          const timeframe = readStringParam(params, "timeframe") ?? "1mo";
          const limit = readNumberParam(params, "limit", { integer: true }) ?? 30;
          const series = await Promise.all(
            symbols.map((symbol) => client.getMarketData({ symbol, timeframe, limit })),
          );
          const chart = buildIndexedMermaidChart({
            symbols,
            seriesList: series.map((entry) => ({
              symbol: entry.symbol.toUpperCase(),
              series: entry.series,
            })),
          });
          if (!chart.mermaid) {
            throw new Error("insufficient market data to build chart");
          }
          return jsonResult({
            symbols: chart.symbols,
            timeframe,
            chartType: "mermaid-xychart",
            mermaid: chart.mermaid,
            yAxis: { min: chart.yMin, max: chart.yMax },
            points: chart.points,
          });
        }
        default:
          throw new Error(`Unknown finance action: ${action}`);
      }
    },
  };
}
