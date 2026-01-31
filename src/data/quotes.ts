// Quote snapshot helper

import type { QuoteSnapshot } from "./types.js";
import { normalizeYahooSymbol } from "../utils/symbols.js";
import { fetchYahooQuote } from "./providers/yahooFinance.js";

export interface QuoteOptions {
  timeoutMs?: number;
  allowYahoo?: boolean;
}

export async function fetchQuoteSnapshot(symbol: string, options: QuoteOptions = {}): Promise<QuoteSnapshot | null> {
  const allowYahoo = options.allowYahoo ?? process.env.YAHOO_FINANCE_ENABLED !== "false";
  if (!allowYahoo) return null;

  const normalized = normalizeYahooSymbol(symbol);
  const timeoutMs = options.timeoutMs ?? parseTimeout();

  try {
    return await fetchYahooQuote(normalized, timeoutMs);
  } catch (error) {
    console.warn(`Quote fetch failed for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function parseTimeout(): number | undefined {
  const raw = process.env.DATA_TIMEOUT_MS;
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}
