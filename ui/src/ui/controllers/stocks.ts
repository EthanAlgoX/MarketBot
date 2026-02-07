import type { GatewayBrowserClient } from "../gateway";
import type { DailyStockRunResult } from "../types";

export type StocksState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  stocksLoading: boolean;
  stocksRunning: boolean;
  stocksError: string | null;
  stocksWatchlistText: string;
  stocksTimeframe: string;
  stocksReportType: "simple" | "full";
  stocksNewsLimit: string;
  stocksLocale: string;
  stocksLast: DailyStockRunResult | null;
};

function normalizeSymbolsFromText(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function loadStocks(state: StocksState) {
  if (!state.client || !state.connected) return;
  if (state.stocksLoading) return;
  state.stocksLoading = true;
  state.stocksError = null;
  try {
    const [watchlistRes, lastRes] = await Promise.all([
      state.client.request("finance.watchlist.get", {}),
      state.client.request("finance.daily.last", {}),
    ]);
    const watchlist = (watchlistRes as any)?.watchlist;
    if (Array.isArray(watchlist)) {
      state.stocksWatchlistText = watchlist.join("\n");
    }
    const last = (lastRes as any)?.last as DailyStockRunResult | null | undefined;
    state.stocksLast = last ?? null;
  } catch (err) {
    state.stocksError = String(err);
  } finally {
    state.stocksLoading = false;
  }
}

export async function saveStocksWatchlist(state: StocksState) {
  if (!state.client || !state.connected) return;
  state.stocksError = null;
  try {
    const symbols = normalizeSymbolsFromText(state.stocksWatchlistText);
    const res = await state.client.request("finance.watchlist.set", { watchlist: symbols });
    const saved = (res as any)?.watchlist;
    if (Array.isArray(saved)) {
      state.stocksWatchlistText = saved.join("\n");
    }
  } catch (err) {
    state.stocksError = String(err);
  }
}

export async function runStocks(state: StocksState) {
  if (!state.client || !state.connected) return;
  if (state.stocksRunning) return;
  state.stocksRunning = true;
  state.stocksError = null;
  try {
    const symbols = normalizeSymbolsFromText(state.stocksWatchlistText);
    const newsLimit = Number.parseInt(state.stocksNewsLimit.trim() || "0", 10);
    const res = await state.client.request("finance.daily.run", {
      symbols: symbols.length > 0 ? symbols : undefined,
      timeframe: state.stocksTimeframe.trim() || undefined,
      reportType: state.stocksReportType,
      newsLimit: Number.isFinite(newsLimit) ? newsLimit : undefined,
      locale: state.stocksLocale.trim() || undefined,
      includeFundamentals: state.stocksReportType === "full",
      profile: "marketbot",
    });
    const result = (res as any)?.result as DailyStockRunResult | undefined;
    if (result) {
      state.stocksLast = result;
    }
  } catch (err) {
    state.stocksError = String(err);
  } finally {
    state.stocksRunning = false;
  }
}

