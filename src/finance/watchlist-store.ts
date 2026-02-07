/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import fs from "node:fs/promises";
import path from "node:path";

import { resolveStateDir } from "../config/paths.js";

export type WatchlistsFileV1 = {
  version: 1;
  updatedAtIso: string;
  watchlists: Record<string, string[]>;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

function isValidSymbol(symbol: string): boolean {
  // Keep it permissive enough for Yahoo normalized tickers (e.g. 00700.HK, 600519.SS).
  return /^[A-Z0-9.^=_-]{1,20}$/.test(symbol);
}

function uniqStable(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) {
      continue;
    }
    seen.add(v);
    out.push(v);
  }
  return out;
}

function resolveWatchlistsPath() {
  const dir = path.join(resolveStateDir(), "finance");
  const filePath = path.join(dir, "watchlists.json");
  return { dir, filePath };
}

async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err: any) {
    if (err && typeof err === "object" && err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

function coerceV1(data: unknown): WatchlistsFileV1 | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const version = (data as any).version;
  if (version !== 1) {
    return null;
  }
  const watchlistsRaw = (data as any).watchlists;
  if (!watchlistsRaw || typeof watchlistsRaw !== "object") {
    return null;
  }
  const watchlists: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(watchlistsRaw as Record<string, unknown>)) {
    if (!k || typeof k !== "string") {
      continue;
    }
    if (!Array.isArray(v)) {
      continue;
    }
    const list = v
      .map((x) => (typeof x === "string" ? normalizeSymbol(x) : ""))
      .filter((x) => x && isValidSymbol(x));
    watchlists[k] = uniqStable(list);
  }
  return {
    version: 1,
    updatedAtIso:
      typeof (data as any).updatedAtIso === "string" ? (data as any).updatedAtIso : nowIso(),
    watchlists,
  };
}

export async function loadWatchlist(name = "default"): Promise<string[]> {
  const { filePath } = resolveWatchlistsPath();
  const raw = await readFileOrNull(filePath);
  if (!raw) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const v1 = coerceV1(parsed);
  if (!v1) {
    return [];
  }
  return v1.watchlists[name] ?? [];
}

export async function saveWatchlist(params: { name?: string; symbols: string[] }) {
  const name = params.name ?? "default";
  const normalized = uniqStable(
    params.symbols.map(normalizeSymbol).filter((s) => s && isValidSymbol(s)),
  );

  const { dir, filePath } = resolveWatchlistsPath();
  await fs.mkdir(dir, { recursive: true });

  const existingRaw = await readFileOrNull(filePath);
  const existing = existingRaw ? coerceV1(safeJsonParse(existingRaw)) : null;
  const next: WatchlistsFileV1 = existing ?? { version: 1, updatedAtIso: nowIso(), watchlists: {} };
  next.watchlists[name] = normalized;
  next.updatedAtIso = nowIso();

  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await fs.rename(tmp, filePath);
  return { name, symbols: normalized, updatedAtIso: next.updatedAtIso };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
