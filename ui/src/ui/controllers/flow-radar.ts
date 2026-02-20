import type { GatewayBrowserClient } from "../gateway";
import type { FlowAssetClass, FlowDetail, FlowSnapshot } from "../types";

const DEFAULT_CLASSES: FlowAssetClass[] = ["usStocks", "hkStocks", "aStocks", "metals", "crypto"];
const FLOW_PROVIDER_ORDER = ["openbb", "yahoo", "stooq", "google-news"] as const;

export type FlowRadarState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  flowRadarLoading: boolean;
  flowRadarDetailLoading: boolean;
  flowRadarError: string | null;
  flowRadarSnapshot: FlowSnapshot | null;
  flowRadarActiveAssetClass: FlowAssetClass | null;
  flowRadarActiveSymbol: string | null;
  flowRadarDetail: FlowDetail | null;
};

function findFirstSelection(snapshot: FlowSnapshot | null): { assetClass: FlowAssetClass; symbol: string } | null {
  if (!snapshot) return null;
  for (const assetClass of DEFAULT_CLASSES) {
    const bucket = snapshot.buckets.find((entry) => entry.assetClass === assetClass);
    const symbol = bucket?.items[0]?.symbol;
    if (!symbol) continue;
    return { assetClass, symbol };
  }
  for (const bucket of snapshot.buckets) {
    const symbol = bucket.items[0]?.symbol;
    if (!symbol) continue;
    return { assetClass: bucket.assetClass, symbol };
  }
  return null;
}

function hasSelection(snapshot: FlowSnapshot | null, assetClass: FlowAssetClass | null, symbol: string | null): boolean {
  if (!snapshot || !assetClass || !symbol) return false;
  const bucket = snapshot.buckets.find((entry) => entry.assetClass === assetClass);
  return Boolean(bucket?.items.some((item) => item.symbol === symbol));
}

export async function runFlowRadarSnapshot(state: FlowRadarState) {
  if (!state.client || !state.connected) return;
  if (state.flowRadarLoading) return;
  state.flowRadarLoading = true;
  state.flowRadarError = null;
  try {
    const snapshot = (await state.client.request("finance.flow.snapshot", {
      topN: 10,
      reasonNewsLimit: 4,
      locale: "US",
      provider: "openbb",
      assetClasses: DEFAULT_CLASSES,
      providerOrder: Array.from(FLOW_PROVIDER_ORDER),
    })) as FlowSnapshot;
    state.flowRadarSnapshot = snapshot ?? null;
    if (!hasSelection(snapshot, state.flowRadarActiveAssetClass, state.flowRadarActiveSymbol)) {
      const selection = findFirstSelection(snapshot);
      state.flowRadarActiveAssetClass = selection?.assetClass ?? null;
      state.flowRadarActiveSymbol = selection?.symbol ?? null;
    }
    await loadFlowRadarDetail(state);
  } catch (err) {
    state.flowRadarError = String(err);
  } finally {
    state.flowRadarLoading = false;
  }
}

export async function loadFlowRadarDetail(
  state: FlowRadarState,
  opts?: { assetClass?: FlowAssetClass; symbol?: string },
) {
  if (!state.client || !state.connected) return;
  const assetClass = opts?.assetClass ?? state.flowRadarActiveAssetClass;
  const symbol = (opts?.symbol ?? state.flowRadarActiveSymbol)?.trim().toUpperCase() ?? "";
  if (!assetClass || !symbol) {
    state.flowRadarDetail = null;
    return;
  }
  state.flowRadarDetailLoading = true;
  state.flowRadarError = null;
  state.flowRadarActiveAssetClass = assetClass;
  state.flowRadarActiveSymbol = symbol;
  try {
    const detail = (await state.client.request("finance.flow.detail", {
      symbol,
      assetClass,
      locale: "US",
      provider: "openbb",
      providerOrder: Array.from(FLOW_PROVIDER_ORDER),
    })) as FlowDetail;
    state.flowRadarDetail = detail ?? null;
  } catch (err) {
    state.flowRadarError = String(err);
  } finally {
    state.flowRadarDetailLoading = false;
  }
}
