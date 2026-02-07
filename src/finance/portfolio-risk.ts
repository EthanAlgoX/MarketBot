/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import type {
  CorrelationMatrix,
  MarketSeries,
  PortfolioRiskContribution,
  PortfolioRiskOverview,
} from "./types.js";
import { maxDrawdown, valueAtRisk } from "./indicators.js";
import {
  annualizeVolatility,
  beta,
  correlation,
  resolvePeriodsPerYear,
  returnsFromCloses,
  stdev,
} from "./stats.js";

function pickCloses(series: MarketSeries): number[] {
  return series.series.map((p) => p.close).filter((v): v is number => typeof v === "number");
}

function buildCorrelationMatrix(
  symbols: string[],
  returnsBySymbol: Map<string, number[]>,
): CorrelationMatrix {
  const matrix: number[][] = [];
  for (const a of symbols) {
    const row: number[] = [];
    const ra = returnsBySymbol.get(a) ?? [];
    for (const b of symbols) {
      const rb = returnsBySymbol.get(b) ?? [];
      row.push(correlation(ra, rb) ?? Number.NaN);
    }
    matrix.push(row);
  }
  return { symbols, matrix };
}

export function buildPortfolioRisk(params: {
  seriesBySymbol: Map<string, MarketSeries>;
  weights: Map<string, number>;
  timeframe?: string;
  benchmark?: MarketSeries | null;
}): PortfolioRiskOverview {
  const timeframe = params.timeframe;
  const periodsPerYear = resolvePeriodsPerYear(timeframe);

  const symbols = [...params.weights.keys()].map((s) => s.toUpperCase()).toSorted();
  const returnsBySymbol = new Map<string, number[]>();
  for (const symbol of symbols) {
    const series = params.seriesBySymbol.get(symbol);
    const closes = series ? pickCloses(series) : [];
    returnsBySymbol.set(symbol, returnsFromCloses(closes));
  }

  const minLen =
    symbols.length > 0 ? Math.min(...symbols.map((s) => (returnsBySymbol.get(s) ?? []).length)) : 0;
  const portfolioReturns: number[] = [];
  for (let i = 0; i < minLen; i += 1) {
    let r = 0;
    for (const symbol of symbols) {
      const w = params.weights.get(symbol) ?? 0;
      const seriesReturns = returnsBySymbol.get(symbol) ?? [];
      const ri = seriesReturns[i];
      if (!Number.isFinite(ri)) {
        continue;
      }
      r += w * ri;
    }
    portfolioReturns.push(r);
  }

  const vol = annualizeVolatility(stdev(portfolioReturns), periodsPerYear);

  let benchBeta: number | undefined;
  const bench = params.benchmark;
  if (bench) {
    const benchReturns = returnsFromCloses(pickCloses(bench));
    const aligned = benchReturns.slice(-portfolioReturns.length);
    const alignedPortfolio = portfolioReturns.slice(-aligned.length);
    benchBeta = beta(alignedPortfolio, aligned);
  }

  const corr = symbols.length >= 2 ? buildCorrelationMatrix(symbols, returnsBySymbol) : undefined;

  // A simple contribution breakdown: weight * mean return and weight * volatility proxy.
  // (Full covariance-based attribution can be added later without changing the output shape.)
  const contributions: PortfolioRiskContribution[] = symbols.map((symbol) => {
    const w = params.weights.get(symbol) ?? 0;
    const r = returnsBySymbol.get(symbol) ?? [];
    const s = stdev(r);
    const annualVol = annualizeVolatility(s, periodsPerYear);
    const proxy = annualVol !== undefined ? Math.abs(w) * annualVol : undefined;
    return {
      symbol,
      weight: w,
      marginalRisk: annualVol,
      riskContribution: proxy,
    };
  });
  const totalProxy = contributions.reduce((acc, c) => acc + (c.riskContribution ?? 0), 0);
  for (const c of contributions) {
    if (c.riskContribution === undefined || totalProxy === 0) {
      continue;
    }
    c.riskContributionPercent = (c.riskContribution / totalProxy) * 100;
  }

  // Convert return series into a synthetic equity curve for drawdown/VaR.
  const equity: number[] = [];
  let v = 1;
  for (const r of portfolioReturns) {
    v *= 1 + r;
    equity.push(v);
  }

  return {
    timeframe,
    benchmark: bench ? bench.symbol.toUpperCase() : undefined,
    positions: symbols.map((symbol) => ({ symbol, weight: params.weights.get(symbol) })),
    volatility: vol,
    maxDrawdown: maxDrawdown(equity),
    valueAtRisk95: valueAtRisk(equity),
    beta: benchBeta,
    correlation: corr,
    contributions,
  };
}
