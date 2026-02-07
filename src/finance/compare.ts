/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import type { ComparisonOverview, CorrelationMatrix, MarketSeries } from "./types.js";
import { maxDrawdown, valueAtRisk, volatility } from "./indicators.js";
import {
  annualizeVolatility,
  beta,
  correlation,
  resolvePeriodsPerYear,
  returnsFromCloses,
  sharpeRatio,
} from "./stats.js";

function pickCloses(series: MarketSeries): number[] {
  return series.series.map((p) => p.close).filter((v): v is number => typeof v === "number");
}

function computePeriodReturnPercent(closes: number[]): number | undefined {
  if (closes.length < 2) {
    return undefined;
  }
  const first = closes[0];
  const last = closes[closes.length - 1];
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) {
    return undefined;
  }
  return ((last - first) / first) * 100;
}

function alignReturns(seriesList: Array<{ symbol: string; closesByTs: Map<number, number> }>) {
  if (seriesList.length === 0) {
    return { symbols: [], returnsBySymbol: new Map<string, number[]>() };
  }
  let common: Set<number> | null = null;
  for (const entry of seriesList) {
    const keys = new Set(entry.closesByTs.keys());
    if (!common) {
      common = keys;
      continue;
    }

    // Avoid tricky inference around Set iteration/filter in TS; explicit intersection is clearer.
    const next = new Set<number>();
    for (const ts of common) {
      if (keys.has(ts)) {
        next.add(ts);
      }
    }
    common = next;
  }
  const commonTs = [...(common ?? [])].toSorted((a, b) => a - b);
  const returnsBySymbol = new Map<string, number[]>();
  for (const entry of seriesList) {
    const closes: number[] = [];
    for (const ts of commonTs) {
      const close = entry.closesByTs.get(ts);
      if (close === undefined) {
        continue;
      }
      closes.push(close);
    }
    returnsBySymbol.set(entry.symbol, returnsFromCloses(closes));
  }
  return { symbols: seriesList.map((e) => e.symbol), returnsBySymbol };
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
      const corr = correlation(ra, rb);
      row.push(corr ?? Number.NaN);
    }
    matrix.push(row);
  }
  return { symbols, matrix };
}

export function buildComparison(params: {
  series: MarketSeries[];
  timeframe?: string;
  benchmark?: MarketSeries | null;
}): ComparisonOverview {
  const timeframe = params.timeframe;
  const periodsPerYear = resolvePeriodsPerYear(timeframe);

  const closeMaps = params.series.map((s) => {
    const closesByTs = new Map<number, number>();
    for (const point of s.series) {
      if (
        typeof point.ts === "number" &&
        typeof point.close === "number" &&
        Number.isFinite(point.close)
      ) {
        closesByTs.set(point.ts, point.close);
      }
    }
    return { symbol: s.symbol.toUpperCase(), closesByTs, series: s };
  });

  const aligned = alignReturns(
    closeMaps.map((e) => ({ symbol: e.symbol, closesByTs: e.closesByTs })),
  );
  const correlationMatrix =
    aligned.symbols.length >= 2
      ? buildCorrelationMatrix(aligned.symbols, aligned.returnsBySymbol)
      : undefined;

  let benchmarkReturns: number[] | undefined;
  let benchmarkSymbol: string | undefined;
  if (params.benchmark) {
    benchmarkSymbol = params.benchmark.symbol.toUpperCase();
    const closesByTs = new Map<number, number>();
    for (const point of params.benchmark.series) {
      if (
        typeof point.ts === "number" &&
        typeof point.close === "number" &&
        Number.isFinite(point.close)
      ) {
        closesByTs.set(point.ts, point.close);
      }
    }
    const alignedWithBenchmark = alignReturns([
      ...closeMaps.map((e) => ({ symbol: e.symbol, closesByTs: e.closesByTs })),
      { symbol: benchmarkSymbol, closesByTs },
    ]);
    benchmarkReturns = alignedWithBenchmark.returnsBySymbol.get(benchmarkSymbol);
  }

  const assets = params.series.map((s) => {
    const closes = pickCloses(s);
    const returns =
      aligned.returnsBySymbol.get(s.symbol.toUpperCase()) ?? returnsFromCloses(closes);
    const stdevPerPeriod = volatility(closes);
    const volAnnual = annualizeVolatility(stdevPerPeriod, periodsPerYear);
    const b = benchmarkReturns ? beta(returns, benchmarkReturns) : undefined;
    const sharpe = sharpeRatio(returns, periodsPerYear);

    return {
      symbol: s.symbol.toUpperCase(),
      timeframe,
      points: closes.length,
      latestClose: closes[closes.length - 1],
      periodReturnPercent: computePeriodReturnPercent(closes),
      volatility: volAnnual,
      maxDrawdown: maxDrawdown(closes),
      valueAtRisk95: valueAtRisk(closes),
      beta: b,
      sharpe,
    };
  });

  return {
    timeframe,
    benchmark: benchmarkSymbol,
    assets,
    correlation: correlationMatrix,
  };
}
