/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import type {
  MarketSeries,
  PortfolioOptimizationOverview,
  PortfolioRiskOverview,
} from "./types.js";
import { buildPortfolioRisk } from "./portfolio-risk.js";
import { covariance, returnsFromCloses } from "./stats.js";

function pickClosesByTs(series: MarketSeries): Map<number, number> {
  const closes = new Map<number, number>();
  for (const point of series.series) {
    if (
      typeof point.ts === "number" &&
      typeof point.close === "number" &&
      Number.isFinite(point.close)
    ) {
      closes.set(point.ts, point.close);
    }
  }
  return closes;
}

function intersectTimestamps(maps: Map<number, number>[]): number[] {
  let common: Set<number> | null = null;
  for (const m of maps) {
    const keys = new Set(m.keys());
    if (!common) {
      common = keys;
      continue;
    }
    const next = new Set<number>();
    for (const ts of common) {
      if (keys.has(ts)) {
        next.add(ts);
      }
    }
    common = next;
  }
  return [...(common ?? [])].toSorted((a, b) => a - b);
}

function buildAlignedReturns(symbols: string[], seriesBySymbol: Map<string, MarketSeries>) {
  const closeMaps = symbols.map((s) => pickClosesByTs(seriesBySymbol.get(s)!));
  const commonTs = intersectTimestamps(closeMaps);
  const returnsBySymbol = new Map<string, number[]>();
  for (let i = 0; i < symbols.length; i += 1) {
    const symbol = symbols[i];
    const closes: number[] = [];
    const m = closeMaps[i];
    for (const ts of commonTs) {
      const close = m.get(ts);
      if (close !== undefined) {
        closes.push(close);
      }
    }
    returnsBySymbol.set(symbol, returnsFromCloses(closes));
  }
  return returnsBySymbol;
}

function identity(n: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    const row = Array.from({ length: n }, () => 0);
    row[i] = 1;
    out.push(row);
  }
  return out;
}

function invertMatrix(input: number[][]): number[][] | null {
  const n = input.length;
  if (n === 0 || input.some((r) => r.length !== n)) {
    return null;
  }

  // Augment [A | I] and run Gauss-Jordan with partial pivoting.
  const a = input.map((row) => row.slice());
  const inv = identity(n);

  for (let col = 0; col < n; col += 1) {
    // Find pivot row.
    let pivot = col;
    let best = Math.abs(a[col][col]);
    for (let r = col + 1; r < n; r += 1) {
      const v = Math.abs(a[r][col]);
      if (v > best) {
        best = v;
        pivot = r;
      }
    }
    if (!Number.isFinite(best) || best === 0) {
      return null;
    }

    if (pivot !== col) {
      [a[pivot], a[col]] = [a[col], a[pivot]];
      [inv[pivot], inv[col]] = [inv[col], inv[pivot]];
    }

    const diag = a[col][col];
    for (let c = 0; c < n; c += 1) {
      a[col][c] /= diag;
      inv[col][c] /= diag;
    }

    for (let r = 0; r < n; r += 1) {
      if (r === col) {
        continue;
      }
      const factor = a[r][col];
      if (factor === 0) {
        continue;
      }
      for (let c = 0; c < n; c += 1) {
        a[r][c] -= factor * a[col][c];
        inv[r][c] -= factor * inv[col][c];
      }
    }
  }

  return inv;
}

function addRidge(cov: number[][], lambda: number): number[][] {
  const n = cov.length;
  const out = cov.map((r) => r.slice());
  for (let i = 0; i < n; i += 1) {
    out[i][i] = (out[i][i] ?? 0) + lambda;
  }
  return out;
}

function matVecMul(m: number[][], v: number[]): number[] {
  return m.map((row) => row.reduce((acc, x, i) => acc + x * (v[i] ?? 0), 0));
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

function normalizeWeights(raw: number[]): number[] {
  const sum = raw.reduce((acc, v) => acc + v, 0);
  if (!Number.isFinite(sum) || sum === 0) {
    return raw.map(() => 0);
  }
  return raw.map((v) => v / sum);
}

export function buildMinVarianceWeights(params: {
  seriesBySymbol: Map<string, MarketSeries>;
  symbols: string[];
}): Map<string, number> {
  const symbols = params.symbols.map((s) => s.toUpperCase());
  const missing = symbols.filter((s) => !params.seriesBySymbol.has(s));
  if (missing.length > 0) {
    throw new Error(`missing series for: ${missing.join(", ")}`);
  }

  const returnsBySymbol = buildAlignedReturns(symbols, params.seriesBySymbol);
  const n = symbols.length;
  const cov: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    const row: number[] = [];
    const ri = returnsBySymbol.get(symbols[i]) ?? [];
    for (let j = 0; j < n; j += 1) {
      const rj = returnsBySymbol.get(symbols[j]) ?? [];
      const c = covariance(ri, rj);
      row.push(c ?? 0);
    }
    cov.push(row);
  }

  const ones = Array.from({ length: n }, () => 1);
  let lambda = 1e-10;
  let inv: number[][] | null = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    inv = invertMatrix(addRidge(cov, lambda));
    if (inv) {
      break;
    }
    lambda *= 10;
  }
  if (!inv) {
    // Fallback to equal weights if covariance is singular/unusable.
    const w = 1 / Math.max(n, 1);
    return new Map(symbols.map((s) => [s, w]));
  }

  const x = matVecMul(inv, ones);
  const denom = dot(ones, x);
  const w =
    denom !== 0 ? x.map((v) => v / denom) : Array.from({ length: n }, () => 1 / Math.max(n, 1));
  const weights = new Map<string, number>();
  const normalized = normalizeWeights(w);
  for (let i = 0; i < n; i += 1) {
    weights.set(symbols[i], normalized[i]);
  }
  return weights;
}

export function buildPortfolioOptimization(params: {
  seriesBySymbol: Map<string, MarketSeries>;
  symbols: string[];
  timeframe?: string;
  benchmark?: MarketSeries | null;
}): PortfolioOptimizationOverview {
  const weights = buildMinVarianceWeights({
    seriesBySymbol: params.seriesBySymbol,
    symbols: params.symbols,
  });

  const risk: PortfolioRiskOverview = buildPortfolioRisk({
    seriesBySymbol: params.seriesBySymbol,
    weights,
    timeframe: params.timeframe,
    benchmark: params.benchmark,
  });

  return {
    timeframe: params.timeframe,
    benchmark: params.benchmark ? params.benchmark.symbol.toUpperCase() : undefined,
    objective: "min_variance",
    weights: [...weights.entries()]
      .map(([symbol, weight]) => ({ symbol, weight }))
      .toSorted((a, b) => b.weight - a.weight),
    risk,
  };
}
