/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

export function sma(values: number[], period: number): number | undefined {
  if (values.length < period) {
    return undefined;
  }
  const slice = values.slice(values.length - period);
  const sum = slice.reduce((acc, v) => acc + v, 0);
  return sum / period;
}

export function ema(values: number[], period: number): number | undefined {
  if (values.length < period) {
    return undefined;
  }
  const k = 2 / (period + 1);
  let emaValue = values[0];
  for (let i = 1; i < values.length; i += 1) {
    emaValue = values[i] * k + emaValue * (1 - k);
  }
  return emaValue;
}

export function rsi(values: number[], period = 14): number | undefined {
  if (values.length <= period) {
    return undefined;
  }
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) {
    return 100;
  }
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function macd(
  values: number[],
): { macd: number; signal: number; histogram: number } | undefined {
  if (values.length < 35) {
    return undefined;
  }
  const fast = ema(values, 12);
  const slow = ema(values, 26);
  if (fast === undefined || slow === undefined) {
    return undefined;
  }
  const macdLine = fast - slow;
  const signalLine = ema(values.slice(values.length - 35), 9);
  if (signalLine === undefined) {
    return undefined;
  }
  return {
    macd: macdLine,
    signal: signalLine,
    histogram: macdLine - signalLine,
  };
}

export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): number | undefined {
  if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
    return undefined;
  }
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i += 1) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }
  if (trs.length < period) {
    return undefined;
  }
  const slice = trs.slice(trs.length - period);
  const sum = slice.reduce((acc, v) => acc + v, 0);
  return sum / period;
}

export function volatility(values: number[], period = 20): number | undefined {
  if (values.length < period + 1) {
    return undefined;
  }
  const returns: number[] = [];
  for (let i = values.length - period; i < values.length; i += 1) {
    const prev = values[i - 1];
    const cur = values[i];
    if (prev === 0) {
      continue;
    }
    returns.push((cur - prev) / prev);
  }
  if (returns.length === 0) {
    return undefined;
  }
  const mean = returns.reduce((acc, v) => acc + v, 0) / returns.length;
  const variance = returns.reduce((acc, v) => acc + (v - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
}

export function maxDrawdown(values: number[]): number | undefined {
  if (values.length < 2) {
    return undefined;
  }
  let peak = values[0];
  let maxDd = 0;
  for (const val of values) {
    if (val > peak) {
      peak = val;
    }
    const dd = (peak - val) / peak;
    if (dd > maxDd) {
      maxDd = dd;
    }
  }
  return maxDd;
}

export function valueAtRisk(values: number[], confidence = 0.95): number | undefined {
  if (values.length < 2) {
    return undefined;
  }
  const returns: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1];
    const cur = values[i];
    if (prev === 0) {
      continue;
    }
    returns.push((cur - prev) / prev);
  }
  if (returns.length === 0) {
    return undefined;
  }
  const sorted = returns.toSorted((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length);
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}
