/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

const INTRADAY_INTERVALS = new Set(["1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h"]);

export function normalizeTimeframe(timeframe?: string): string {
  const trimmed = timeframe?.trim().toLowerCase();
  return trimmed && trimmed.length > 0 ? trimmed : "6mo";
}

export function resolveYahooRange(timeframe?: string): { range: string; interval: string } {
  const tf = normalizeTimeframe(timeframe);
  if (INTRADAY_INTERVALS.has(tf)) {
    if (tf === "1m" || tf === "2m" || tf === "5m" || tf === "15m") {
      return { range: "1d", interval: tf };
    }
    if (tf === "30m") {
      return { range: "5d", interval: tf };
    }
    return { range: "1mo", interval: tf };
  }

  if (tf === "1d" || tf === "5d") {
    return { range: tf, interval: "5m" };
  }
  if (tf === "1w") {
    return { range: "1mo", interval: "1d" };
  }
  if (tf.endsWith("mo")) {
    return { range: tf, interval: "1d" };
  }
  if (tf.endsWith("y") || tf === "ytd" || tf === "max") {
    return { range: tf, interval: "1d" };
  }
  return { range: "6mo", interval: "1d" };
}
