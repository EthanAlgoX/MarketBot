/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import { Type } from "@sinclair/typebox";
import { MarketDataClient } from "../finance/client.js";
import { analyzeRisk, analyzeTechnicals } from "../finance/analysis.js";
import { buildFinanceBrief } from "../finance/brief.js";
import { buildComparison } from "../finance/compare.js";
import { buildPortfolioOverview } from "../finance/portfolio.js";
import { buildPortfolioRisk } from "../finance/portfolio-risk.js";
import type { Skill } from "./types.js";
import type { MarketSeries, PortfolioPosition, Quote } from "../finance/types.js";

const FetchSchema = Type.Object({
  action: Type.Optional(Type.String()),
  symbol: Type.String(),
  timeframe: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number()),
});

const AnalysisSchema = Type.Object({
  action: Type.String(),
  symbol: Type.Optional(Type.String()),
  timeframe: Type.Optional(Type.String()),
  data: Type.Optional(Type.Object({}, { additionalProperties: true })),
});

const PortfolioSchema = Type.Object({
  positions: Type.Array(
    Type.Object({
      symbol: Type.String(),
      quantity: Type.Number(),
      costBasis: Type.Optional(Type.Number()),
    }),
  ),
});

const NewsSchema = Type.Object({
  action: Type.Optional(Type.String()),
  query: Type.String(),
  limit: Type.Optional(Type.Number()),
  locale: Type.Optional(Type.String()),
});

const CompareSchema = Type.Object({
  symbols: Type.Array(Type.String()),
  timeframe: Type.Optional(Type.String()),
  benchmark: Type.Optional(Type.String()),
});

const PortfolioRiskSchema = Type.Object({
  positions: Type.Array(
    Type.Object({
      symbol: Type.String(),
      quantity: Type.Number(),
      costBasis: Type.Optional(Type.Number()),
    }),
  ),
  // If provided, weights win over value-derived weights. Values are normalized.
  weights: Type.Optional(Type.Record(Type.String(), Type.Number())),
  timeframe: Type.Optional(Type.String()),
  benchmark: Type.Optional(Type.String()),
});

const BriefSchema = Type.Object({
  symbol: Type.Optional(Type.String()),
  query: Type.Optional(Type.String()),
  timeframe: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number()),
  locale: Type.Optional(Type.String()),
  noSymbol: Type.Optional(Type.Boolean()),
});

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

function normalizeSymbol(input: string) {
  return input.trim().toUpperCase();
}

function normalizeWeights(weights: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  let sum = 0;
  for (const [k, v] of weights) {
    if (!k) {
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v)) {
      continue;
    }
    const w = v;
    out.set(normalizeSymbol(k), w);
    sum += w;
  }
  if (sum === 0) {
    return out;
  }
  for (const [k, v] of out) {
    out.set(k, v / sum);
  }
  return out;
}

function weightsFromPositions(
  positions: PortfolioPosition[],
  quotes: Quote[],
): Map<string, number> {
  const bySymbol = new Map<string, Quote>();
  for (const q of quotes) {
    if (q.symbol) {
      bySymbol.set(normalizeSymbol(q.symbol), q);
    }
  }
  const values = new Map<string, number>();
  for (const p of positions) {
    const symbol = normalizeSymbol(p.symbol);
    const price = bySymbol.get(symbol)?.regularMarketPrice;
    const value =
      typeof price === "number" && Number.isFinite(price) ? price * p.quantity : Number.NaN;
    if (Number.isFinite(value)) {
      values.set(symbol, value);
    }
  }
  const total = [...values.values()].reduce((acc, v) => acc + v, 0);
  if (total > 0) {
    const weights = new Map<string, number>();
    for (const [s, v] of values) {
      weights.set(s, v / total);
    }
    return weights;
  }
  const n = positions.length;
  const weights = new Map<string, number>();
  if (n > 0) {
    const w = 1 / n;
    for (const p of positions) {
      weights.set(normalizeSymbol(p.symbol), w);
    }
  }
  return weights;
}

export function createFinanceSkills(options?: { profile?: string }): Skill[] {
  const client = new MarketDataClient({ profile: options?.profile ?? "marketbot" });

  const fetchSkill: Skill = {
    name: "fetch",
    description: "Fetch market chart data via browser-based providers.",
    schema: FetchSchema,
    execute: async (input: Record<string, unknown>) => {
      const action = typeof input.action === "string" ? input.action : "market_data";
      if (action !== "market_data") {
        throw new Error(`fetch.${action} not supported`);
      }
      const symbol = typeof input.symbol === "string" ? input.symbol.trim() : "";
      if (!symbol) {
        throw new Error("symbol required");
      }
      const timeframe = typeof input.timeframe === "string" ? input.timeframe : undefined;
      const limit = typeof input.limit === "number" ? Math.trunc(input.limit) : undefined;
      return await client.getMarketData({ symbol, timeframe, limit });
    },
  };

  const analysisSkill: Skill = {
    name: "analysis",
    description: "Run technical/risk analysis and fundamentals summaries.",
    schema: AnalysisSchema,
    execute: async (input: Record<string, unknown>) => {
      const action = typeof input.action === "string" ? input.action : "technicals";
      const timeframe = typeof input.timeframe === "string" ? input.timeframe : undefined;
      const data = coerceMarketSeries(input.data);
      const symbol = typeof input.symbol === "string" ? input.symbol : data?.symbol;
      if (!symbol && !data) {
        throw new Error("symbol or data required");
      }
      if (action === "technicals") {
        const series = data ?? (await client.getMarketData({ symbol: symbol!, timeframe }));
        return analyzeTechnicals(series, timeframe);
      }
      if (action === "risk") {
        const series = data ?? (await client.getMarketData({ symbol: symbol!, timeframe }));
        return analyzeRisk(series, timeframe);
      }
      if (action === "fundamentals") {
        return await client.getFundamentals(symbol!);
      }
      if (action === "summary") {
        const series = data ?? (await client.getMarketData({ symbol: symbol!, timeframe }));
        const technicals = analyzeTechnicals(series, timeframe);
        const risk = analyzeRisk(series, timeframe);
        const fundamentals = await client.getFundamentals(symbol!);
        const quotes = await client.getQuotes([symbol!]);
        return {
          series,
          technicals,
          risk,
          fundamentals,
          quote: quotes[0],
        };
      }
      throw new Error(`analysis.${action} not supported`);
    },
  };

  const portfolioSkill: Skill = {
    name: "portfolio",
    description: "Summarize portfolio positions with current market pricing.",
    schema: PortfolioSchema,
    execute: async (input: Record<string, unknown>) => {
      const positionsRaw = input.positions;
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
      return buildPortfolioOverview(positions, quotes);
    },
  };

  const newsSkill: Skill = {
    name: "news",
    description: "Fetch market news headlines via the browser RSS feed.",
    schema: NewsSchema,
    execute: async (input: Record<string, unknown>) => {
      const query = typeof input.query === "string" ? input.query : "";
      if (!query.trim()) {
        throw new Error("query required");
      }
      const limit = typeof input.limit === "number" ? Math.trunc(input.limit) : undefined;
      const locale = typeof input.locale === "string" ? input.locale : undefined;
      const items = await client.getNews({ query, limit, locale });
      return { query, items };
    },
  };

  const compareSkill: Skill = {
    name: "compare",
    description: "Compare multiple symbols (correlations, volatility, drawdowns, beta, sharpe).",
    schema: CompareSchema,
    execute: async (input: Record<string, unknown>) => {
      const raw = input.symbols;
      if (!Array.isArray(raw) || raw.length < 2) {
        throw new Error("symbols (>=2) required");
      }
      const symbols = raw
        .map((s) => (typeof s === "string" ? normalizeSymbol(s) : ""))
        .filter(Boolean);
      if (symbols.length < 2) {
        throw new Error("symbols (>=2) required");
      }
      const timeframe = typeof input.timeframe === "string" ? input.timeframe : undefined;
      const benchmark =
        typeof input.benchmark === "string" && input.benchmark.trim()
          ? await client.getMarketData({ symbol: input.benchmark, timeframe })
          : null;
      const series = await Promise.all(
        symbols.map((symbol) => client.getMarketData({ symbol, timeframe })),
      );
      return buildComparison({ series, timeframe, benchmark });
    },
  };

  const portfolioRiskSkill: Skill = {
    name: "portfolio_risk",
    description:
      "Compute portfolio risk metrics (volatility, drawdown, VaR, beta, risk contributions).",
    schema: PortfolioRiskSchema,
    execute: async (input: Record<string, unknown>) => {
      const positionsRaw = input.positions;
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

      const timeframe = typeof input.timeframe === "string" ? input.timeframe : undefined;
      const bench =
        typeof input.benchmark === "string" && input.benchmark.trim()
          ? await client.getMarketData({ symbol: input.benchmark, timeframe })
          : null;

      let weights: Map<string, number> | null = null;
      if (input.weights && typeof input.weights === "object") {
        const w = new Map<string, number>();
        for (const [k, v] of Object.entries(input.weights as Record<string, unknown>)) {
          if (typeof v === "number") {
            w.set(k, v);
          }
        }
        const normalized = normalizeWeights(w);
        if (normalized.size > 0) {
          weights = normalized;
        }
      }

      const symbols = positions.map((p) => normalizeSymbol(p.symbol));
      const quotes = await client.getQuotes(symbols);
      const weightsResolved = weights ?? weightsFromPositions(positions, quotes);

      const series = await Promise.all(
        symbols.map((symbol) => client.getMarketData({ symbol, timeframe })),
      );
      const seriesBySymbol = new Map<string, MarketSeries>();
      for (const s of series) {
        seriesBySymbol.set(normalizeSymbol(s.symbol), s);
      }

      return buildPortfolioRisk({
        seriesBySymbol,
        weights: weightsResolved,
        timeframe,
        benchmark: bench,
      });
    },
  };

  const briefSkill: Skill = {
    name: "brief",
    description: "Build a news-driven brief (with optional quote/fundamentals/technicals/risk).",
    schema: BriefSchema,
    execute: async (input: Record<string, unknown>) => {
      const symbol = typeof input.symbol === "string" ? normalizeSymbol(input.symbol) : "";
      const noSymbol = typeof input.noSymbol === "boolean" ? input.noSymbol : false;
      const queryRaw = typeof input.query === "string" ? input.query.trim() : "";
      const query = queryRaw || symbol;
      if (!query) {
        throw new Error("symbol or query required");
      }

      const timeframe = typeof input.timeframe === "string" ? input.timeframe : undefined;
      const limit = typeof input.limit === "number" ? Math.trunc(input.limit) : undefined;
      const locale = typeof input.locale === "string" ? input.locale : undefined;
      const items = await client.getNews({ query, limit, locale });

      if (!symbol || noSymbol) {
        return buildFinanceBrief({ query, items, timeframe });
      }

      const series = await client.getMarketData({ symbol, timeframe });
      const quotes = await client.getQuotes([symbol]);
      const fundamentals = await client.getFundamentals(symbol);
      const technicals = analyzeTechnicals(series, timeframe);
      const risk = analyzeRisk(series, timeframe);
      return buildFinanceBrief({
        symbol,
        query,
        items,
        timeframe,
        quote: quotes[0],
        fundamentals,
        technicals,
        risk,
      });
    },
  };

  return [
    fetchSkill,
    analysisSkill,
    portfolioSkill,
    portfolioRiskSkill,
    newsSkill,
    compareSkill,
    briefSkill,
  ];
}
