// Quote snapshot helper

import type { QuoteSnapshot } from "./types.js";
import { normalizeYahooSymbol } from "../utils/symbols.js";
import { fetchYahooQuote, fetchYahooQuoteFromHtml } from "./providers/yahooFinance.js";

type QuoteCacheEntry = {
  snapshot: QuoteSnapshot;
  expiresAt: number;
};

const QUOTE_CACHE = new Map<string, QuoteCacheEntry>();

export interface QuoteOptions {
  timeoutMs?: number;
  allowYahoo?: boolean;
}

export async function fetchQuoteSnapshot(symbol: string, options: QuoteOptions = {}): Promise<QuoteSnapshot | null> {
  const allowYahoo = options.allowYahoo ?? process.env.YAHOO_FINANCE_ENABLED !== "false";
  if (!allowYahoo) return null;

  const normalized = normalizeYahooSymbol(symbol);
  const timeoutMs = options.timeoutMs ?? parseTimeout();
  const cacheTtlMs = parseCacheTtlMs();

  if (cacheTtlMs > 0) {
    const cached = QUOTE_CACHE.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.snapshot;
    }
  }

  try {
    const snapshot = await fetchYahooQuote(normalized, timeoutMs);
    if (snapshot && cacheTtlMs > 0) {
      QUOTE_CACHE.set(normalized, { snapshot, expiresAt: Date.now() + cacheTtlMs });
    }
    return snapshot;
  } catch (error) {
    console.warn(`Quote fetch failed for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    const cached = QUOTE_CACHE.get(normalized);
    if (cached) return cached.snapshot;
    return null;
  }
}

export async function fetchQuoteSnapshotFromHtml(
  symbol: string,
  options: QuoteOptions = {},
): Promise<QuoteSnapshot | null> {
  const allowYahoo = options.allowYahoo ?? process.env.YAHOO_FINANCE_ENABLED !== "false";
  if (!allowYahoo) return null;

  const normalized = normalizeYahooSymbol(symbol);
  const timeoutMs = options.timeoutMs ?? parseTimeout();

  try {
    return await fetchYahooQuoteFromHtml(normalized, timeoutMs);
  } catch (error) {
    console.warn(`HTML quote fetch failed for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function parseTimeout(): number | undefined {
  const raw = process.env.DATA_TIMEOUT_MS;
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCacheTtlMs(): number {
  const raw = process.env.QUOTE_CACHE_TTL_MS ?? "15000";
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 15000;
}
