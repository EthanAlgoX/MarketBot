/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import type { MarketSeries, Quote } from "./types.js";

function parseIsoDateToMs(date: string): number | null {
  // Stooq uses YYYY-MM-DD.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

export function resolveStooqSymbol(symbol: string): string | null {
  const trimmed = symbol.trim().toUpperCase();
  if (!trimmed) {
    return null;
  }
  // Best-effort mapping: US equities like AAPL -> aapl.us
  if (/^[A-Z.]{1,10}$/.test(trimmed) && !trimmed.startsWith("^")) {
    return `${trimmed.toLowerCase()}.us`;
  }
  return null;
}

export function buildStooqDailyUrl(symbol: string): string {
  // CSV: Date,Open,High,Low,Close,Volume
  return `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`;
}

export function parseStooqDailyCsv(csv: string, originalSymbol: string): MarketSeries {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("Stooq CSV missing data");
  }
  const header = lines[0].toLowerCase();
  if (!header.includes("date") || !header.includes("close")) {
    throw new Error("Stooq CSV header not recognized");
  }

  const points: MarketSeries["series"] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",");
    if (parts.length < 5) {
      continue;
    }
    const date = parts[0];
    const ts = parseIsoDateToMs(date);
    if (ts === null) {
      continue;
    }
    const open = Number(parts[1]);
    const high = Number(parts[2]);
    const low = Number(parts[3]);
    const close = Number(parts[4]);
    const volume = parts.length >= 6 ? Number(parts[5]) : Number.NaN;
    points.push({
      ts,
      iso: new Date(ts).toISOString(),
      open: Number.isFinite(open) ? open : undefined,
      high: Number.isFinite(high) ? high : undefined,
      low: Number.isFinite(low) ? low : undefined,
      close: Number.isFinite(close) ? close : undefined,
      volume: Number.isFinite(volume) ? volume : undefined,
    });
  }

  if (points.length === 0) {
    throw new Error("Stooq CSV contained no parsable rows");
  }

  return {
    symbol: originalSymbol.toUpperCase(),
    source: "unknown",
    series: points,
  };
}

export function parseStooqQuoteFromDailyCsv(csv: string, originalSymbol: string): Quote {
  const series = parseStooqDailyCsv(csv, originalSymbol);
  const points = series.series.filter((p) => typeof p.close === "number");
  if (points.length === 0) {
    throw new Error("Stooq CSV contained no close prices");
  }
  const last = points.at(-1);
  if (!last || typeof last.close !== "number") {
    throw new Error("Stooq CSV missing latest close");
  }
  const prev = points.length >= 2 ? points.at(-2) : undefined;
  const prevClose = prev && typeof prev.close === "number" ? prev.close : undefined;
  const change = prevClose !== undefined ? last.close - prevClose : undefined;
  const changePct =
    prevClose !== undefined && prevClose !== 0 ? (change ?? 0) / prevClose : undefined;

  return {
    symbol: series.symbol,
    regularMarketPrice: last.close,
    ...(change !== undefined ? { regularMarketChange: change } : {}),
    ...(changePct !== undefined ? { regularMarketChangePercent: changePct } : {}),
    ...(typeof last.ts === "number" ? { regularMarketTime: last.ts } : {}),
  };
}
