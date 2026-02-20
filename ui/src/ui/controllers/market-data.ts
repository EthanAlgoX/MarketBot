import type { GatewayBrowserClient } from "../gateway";
import type { MarketDataSnapshot, MarketDataStatus } from "../types";

const MAG7_SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA"] as const;

export type MarketDataState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  marketDataLoading: boolean;
  marketDataError: string | null;
  marketDataSymbolsText: string;
  marketDataTimeframe: string;
  marketDataNewsLimit: string;
  marketDataActiveSymbol: string;
  marketDataStatus: MarketDataStatus | null;
  marketDataSnapshot: MarketDataSnapshot | null;
};

function normalizeSymbolsFromText(text: string): string[] {
  const symbols = text
    .split(/[\n,]+/)
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const symbol of symbols) {
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    deduped.push(symbol);
  }
  return deduped;
}

function resolveNewsLimit(value: string): number {
  const parsed = Number.parseInt(value.trim() || "0", 10);
  if (!Number.isFinite(parsed)) {
    return 5;
  }
  return Math.max(0, Math.min(20, parsed));
}

export function applyMag7Preset(state: MarketDataState) {
  state.marketDataSymbolsText = MAG7_SYMBOLS.join("\n");
  state.marketDataActiveSymbol = "AAPL";
}

export async function loadMarketDataStatus(state: MarketDataState) {
  if (!state.client || !state.connected) return;
  try {
    const result = (await state.client.request("finance.market.status", {})) as MarketDataStatus;
    state.marketDataStatus = result ?? null;
  } catch (err) {
    state.marketDataError = String(err);
  }
}

export async function runMarketDataSnapshot(state: MarketDataState) {
  if (!state.client || !state.connected) return;
  if (state.marketDataLoading) return;
  state.marketDataLoading = true;
  state.marketDataError = null;
  try {
    const symbolsFromText = normalizeSymbolsFromText(state.marketDataSymbolsText);
    const symbols = symbolsFromText.length > 0 ? symbolsFromText : Array.from(MAG7_SYMBOLS);
    if (symbolsFromText.length === 0) {
      state.marketDataSymbolsText = symbols.join("\n");
    }
    const activeSymbol = state.marketDataActiveSymbol.trim().toUpperCase();
    const targetSymbol = symbols.includes(activeSymbol) ? activeSymbol : symbols[0];
    const response = (await state.client.request("finance.market.snapshot", {
      symbols,
      timeframe: state.marketDataTimeframe.trim() || "6mo",
      newsLimit: resolveNewsLimit(state.marketDataNewsLimit),
      activeSymbol: targetSymbol,
      locale: "US",
      includeFundamentals: true,
      provider: "openbb",
      seriesLimit: 120,
    })) as MarketDataSnapshot;
    state.marketDataSnapshot = response ?? null;
    state.marketDataActiveSymbol = response?.activeSymbol ?? targetSymbol;
    await loadMarketDataStatus(state);
  } catch (err) {
    state.marketDataError = String(err);
  } finally {
    state.marketDataLoading = false;
  }
}
