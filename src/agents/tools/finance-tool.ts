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
import { MarketDataClient } from "../../finance/client.js";
import { analyzeRisk, analyzeTechnicals } from "../../finance/analysis.js";
import { buildPortfolioOverview } from "../../finance/portfolio.js";
import type { MarketSeries, PortfolioPosition } from "../../finance/types.js";
import { buildComparison } from "../../finance/compare.js";
import { buildFinanceBrief } from "../../finance/brief.js";
import { buildPortfolioRisk } from "../../finance/portfolio-risk.js";
import { buildPortfolioOptimization } from "../../finance/optimize.js";

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
    source: (obj.source as "yahoo" | "unknown") ?? "unknown",
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

export function createFinanceTool(): AnyAgentTool {
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
      const client = new MarketDataClient({ profile });

      switch (action) {
        case "market_data": {
          const symbol = readStringParam(params, "symbol", { required: true });
          const timeframe = readStringParam(params, "timeframe");
          const limit = readNumberParam(params, "limit", { integer: true });
          const series = await client.getMarketData({ symbol, timeframe, limit });
          return jsonResult(series);
        }
        case "quote": {
          const symbols =
            readStringArrayParam(params, "symbols") ??
            (readStringParam(params, "symbol") ? [readStringParam(params, "symbol")!] : undefined);
          if (!symbols || symbols.length === 0) {
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
          const symbols =
            readStringArrayParam(params, "symbols") ??
            (readStringParam(params, "symbol") ? [readStringParam(params, "symbol")!] : undefined);
          if (!symbols || symbols.length < 2) {
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
          const query = readStringParam(params, "query", { required: true });
          const limit = readNumberParam(params, "limit", { integer: true });
          const locale = readStringParam(params, "locale");
          const items = await client.getNews({ query, limit, locale });
          return jsonResult({ query, items });
        }
        case "compare": {
          const symbols =
            readStringArrayParam(params, "symbols") ??
            (readStringParam(params, "symbol") ? [readStringParam(params, "symbol")!] : undefined);
          if (!symbols || symbols.length < 2) {
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
        default:
          throw new Error(`Unknown finance action: ${action}`);
      }
    },
  };
}
