/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

export function mean(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) {
      continue;
    }
    sum += v;
    n += 1;
  }
  return n > 0 ? sum / n : undefined;
}

export function variance(values: number[]): number | undefined {
  if (values.length < 2) {
    return undefined;
  }
  const m = mean(values);
  if (m === undefined) {
    return undefined;
  }
  let sumSq = 0;
  let n = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) {
      continue;
    }
    const d = v - m;
    sumSq += d * d;
    n += 1;
  }
  if (n < 2) {
    return undefined;
  }
  return sumSq / (n - 1);
}

export function stdev(values: number[]): number | undefined {
  const v = variance(values);
  return v === undefined ? undefined : Math.sqrt(v);
}

export function returnsFromCloses(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev === 0) {
      continue;
    }
    out.push(cur / prev - 1);
  }
  return out;
}

export function covariance(a: number[], b: number[]): number | undefined {
  const n = Math.min(a.length, b.length);
  if (n < 2) {
    return undefined;
  }
  const aSlice = a.slice(0, n);
  const bSlice = b.slice(0, n);
  const ma = mean(aSlice);
  const mb = mean(bSlice);
  if (ma === undefined || mb === undefined) {
    return undefined;
  }
  let sum = 0;
  let k = 0;
  for (let i = 0; i < n; i += 1) {
    const da = aSlice[i] - ma;
    const db = bSlice[i] - mb;
    if (!Number.isFinite(da) || !Number.isFinite(db)) {
      continue;
    }
    sum += da * db;
    k += 1;
  }
  if (k < 2) {
    return undefined;
  }
  return sum / (k - 1);
}

export function correlation(a: number[], b: number[]): number | undefined {
  const cov = covariance(a, b);
  if (cov === undefined) {
    return undefined;
  }
  const sa = stdev(a);
  const sb = stdev(b);
  if (!sa || !sb) {
    return undefined;
  }
  return cov / (sa * sb);
}

export function beta(asset: number[], benchmark: number[]): number | undefined {
  const cov = covariance(asset, benchmark);
  const vb = variance(benchmark);
  if (cov === undefined || vb === undefined || vb === 0) {
    return undefined;
  }
  return cov / vb;
}

export function resolvePeriodsPerYear(timeframe?: string): number {
  const tf = (timeframe ?? "").trim().toLowerCase();
  if (!tf) {
    return 252;
  }
  if (tf.endsWith("h")) {
    return 24 * 252;
  }
  if (tf.endsWith("wk") || tf.includes("week")) {
    return 52;
  }
  if (tf.endsWith("mo") || tf.includes("month")) {
    return 12;
  }
  return 252;
}

export function annualizeVolatility(stdevPerPeriod: number | undefined, periodsPerYear: number) {
  if (stdevPerPeriod === undefined) {
    return undefined;
  }
  return stdevPerPeriod * Math.sqrt(periodsPerYear);
}

export function sharpeRatio(returns: number[], periodsPerYear: number): number | undefined {
  const m = mean(returns);
  const s = stdev(returns);
  if (m === undefined || !s || s === 0) {
    return undefined;
  }
  const annualReturn = m * periodsPerYear;
  const annualVol = s * Math.sqrt(periodsPerYear);
  return annualVol !== 0 ? annualReturn / annualVol : undefined;
}
