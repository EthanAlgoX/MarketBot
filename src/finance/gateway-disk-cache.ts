/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

type DiskCacheFileV1<T> = {
  version: 1;
  cachedAtIso: string;
  payload: T;
};

type DiskCacheHit<T> = {
  payload: T;
  cachedAtMs: number;
  ageMs: number;
};

function resolveFinanceCacheDir(): string {
  const override = process.env.MARKETBOT_FINANCE_CACHE_DIR?.trim();
  if (override) {
    return path.resolve(override);
  }
  return path.resolve(process.cwd(), "data", "finance-cache");
}

function canonicalizeValue(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((entry) => canonicalizeValue(entry));
  }
  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => a.localeCompare(b));
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      out[key] = canonicalizeValue(record[key]);
    }
    return out;
  }
  return input;
}

export function buildGatewayFinanceCacheKey(scope: string, params: unknown): string {
  const digest = createHash("sha256")
    .update(JSON.stringify(canonicalizeValue(params)))
    .digest("hex")
    .slice(0, 20);
  const normalizedScope = scope
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
  return `${normalizedScope}-${digest}.json`;
}

function resolveCachePath(key: string): string {
  const safe = key.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
  return path.join(resolveFinanceCacheDir(), safe);
}

export async function readGatewayFinanceCache<T>(
  key: string,
  maxAgeMs: number,
): Promise<DiskCacheHit<T> | null> {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    return null;
  }
  const filePath = resolveCachePath(key);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err: any) {
    if (err && typeof err === "object" && err.code === "ENOENT") {
      return null;
    }
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as DiskCacheFileV1<T>;
    if (!parsed || parsed.version !== 1 || typeof parsed.cachedAtIso !== "string") {
      return null;
    }
    const cachedAtMs = Date.parse(parsed.cachedAtIso);
    if (!Number.isFinite(cachedAtMs)) {
      return null;
    }
    const ageMs = Date.now() - cachedAtMs;
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAgeMs) {
      return null;
    }
    return {
      payload: parsed.payload,
      cachedAtMs,
      ageMs,
    };
  } catch {
    return null;
  }
}

export async function writeGatewayFinanceCache<T>(key: string, payload: T): Promise<void> {
  const dir = resolveFinanceCacheDir();
  const filePath = resolveCachePath(key);
  const record: DiskCacheFileV1<T> = {
    version: 1,
    cachedAtIso: new Date().toISOString(),
    payload,
  };
  try {
    await fs.mkdir(dir, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, `${JSON.stringify(record)}\n`, "utf8");
    await fs.rename(tmpPath, filePath);
  } catch {
    // Best-effort cache writes must not break finance APIs.
  }
}

export function getGatewayFinanceCacheDir(): string {
  return resolveFinanceCacheDir();
}
