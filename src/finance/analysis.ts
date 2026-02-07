/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import type { MarketSeries, RiskMetrics, TechnicalSummary } from "./types.js";
import { atr, macd, maxDrawdown, rsi, sma, ema, volatility, valueAtRisk } from "./indicators.js";

function clampNumber(value: number | undefined): number | undefined {
  if (value === undefined || Number.isNaN(value) || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

function resolveTrend(closes: number[]): "up" | "down" | "sideways" | undefined {
  if (closes.length < 5) {
    return undefined;
  }
  const recent = closes.slice(-5);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (first === 0) {
    return undefined;
  }
  const change = (last - first) / first;
  if (Math.abs(change) < 0.01) {
    return "sideways";
  }
  return change > 0 ? "up" : "down";
}

export function analyzeTechnicals(series: MarketSeries, timeframe?: string): TechnicalSummary {
  const closes = series.series
    .map((p) => p.close)
    .filter((v): v is number => typeof v === "number");
  const highs = series.series.map((p) => p.high).filter((v): v is number => typeof v === "number");
  const lows = series.series.map((p) => p.low).filter((v): v is number => typeof v === "number");

  const latestClose = closes[closes.length - 1];
  const prevClose = closes[closes.length - 2];
  const changePercent =
    latestClose !== undefined && prevClose !== undefined && prevClose !== 0
      ? ((latestClose - prevClose) / prevClose) * 100
      : undefined;

  const rsiValue = clampNumber(rsi(closes));
  const macdValue = macd(closes);
  const sma20 = clampNumber(sma(closes, 20));
  const sma50 = clampNumber(sma(closes, 50));
  const sma200 = clampNumber(sma(closes, 200));
  const ema20 = clampNumber(ema(closes, 20));
  const ema50 = clampNumber(ema(closes, 50));
  const atrValue = clampNumber(atr(highs, lows, closes));
  const volValue = clampNumber(volatility(closes));

  const recentCloses = closes.slice(-20);
  const support = recentCloses.length ? Math.min(...recentCloses) : undefined;
  const resistance = recentCloses.length ? Math.max(...recentCloses) : undefined;

  return {
    symbol: series.symbol,
    timeframe,
    latestClose,
    changePercent,
    trend: resolveTrend(closes),
    rsi: rsiValue,
    macd: macdValue ?? undefined,
    sma: {
      "20": sma20,
      "50": sma50,
      "200": sma200,
    },
    ema: {
      "20": ema20,
      "50": ema50,
    },
    atr: atrValue,
    volatility: volValue,
    support,
    resistance,
  };
}

export function analyzeRisk(series: MarketSeries, timeframe?: string): RiskMetrics {
  const closes = series.series
    .map((p) => p.close)
    .filter((v): v is number => typeof v === "number");
  const volValue = clampNumber(volatility(closes));
  const drawdown = clampNumber(maxDrawdown(closes));
  const var95 = clampNumber(valueAtRisk(closes));

  return {
    symbol: series.symbol,
    timeframe,
    volatility: volValue,
    maxDrawdown: drawdown,
    valueAtRisk95: var95,
  };
}
