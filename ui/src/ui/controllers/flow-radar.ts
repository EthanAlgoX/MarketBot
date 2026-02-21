import type { GatewayBrowserClient } from "../gateway";
import type { FlowAssetClass, FlowDetail, FlowSnapshot } from "../types";

const DEFAULT_CLASSES: FlowAssetClass[] = ["usStocks", "hkStocks", "aStocks", "metals", "crypto"];
const FLOW_PROVIDER_ORDER = ["openbb", "alpaca", "yahoo", "stooq", "google-news"] as const;
const FLOW_RPC_TIMEOUT_MS = 15_000;

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

type FlowCacheControl = {
  refresh?: boolean;
  cacheTtlMs?: number;
};

function withCacheControl(params: Record<string, unknown>, opts?: FlowCacheControl): Record<string, unknown> {
  if (!opts) {
    return params;
  }
  const out: Record<string, unknown> = { ...params };
  if (opts.refresh === true) {
    out.refresh = true;
  }
  if (typeof opts.cacheTtlMs === "number" && Number.isFinite(opts.cacheTtlMs) && opts.cacheTtlMs > 0) {
    out.cacheTtlMs = Math.floor(opts.cacheTtlMs);
  }
  return out;
}

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

async function requestWithTimeout<T>(
  state: FlowRadarState,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  if (!state.client) {
    throw new Error("gateway client unavailable");
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${method} timed out after ${FLOW_RPC_TIMEOUT_MS}ms`)),
      FLOW_RPC_TIMEOUT_MS,
    );
  });
  try {
    return (await Promise.race([state.client.request(method, params), timeoutPromise])) as T;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function runFlowRadarSnapshot(state: FlowRadarState, opts?: FlowCacheControl) {
  if (!state.client || !state.connected) return;
  if (state.flowRadarLoading) return;
  state.flowRadarLoading = true;
  state.flowRadarError = null;
  try {
    const snapshot = await requestWithTimeout<FlowSnapshot>(
      state,
      "finance.flow.snapshot",
      withCacheControl(
        {
          topN: 10,
          reasonNewsLimit: 4,
          locale: "US",
          provider: "openbb",
          assetClasses: DEFAULT_CLASSES,
          providerOrder: Array.from(FLOW_PROVIDER_ORDER),
        },
        opts,
      ),
    );
    state.flowRadarSnapshot = snapshot ?? null;
    if (!hasSelection(snapshot, state.flowRadarActiveAssetClass, state.flowRadarActiveSymbol)) {
      const selection = findFirstSelection(snapshot);
      state.flowRadarActiveAssetClass = selection?.assetClass ?? null;
      state.flowRadarActiveSymbol = selection?.symbol ?? null;
    }
    await loadFlowRadarDetail(state, {
      refresh: opts?.refresh,
      cacheTtlMs: opts?.cacheTtlMs,
    });
  } catch (err) {
    state.flowRadarError = String(err);
  } finally {
    state.flowRadarLoading = false;
  }
}

export async function loadFlowRadarDetail(
  state: FlowRadarState,
  opts?: { assetClass?: FlowAssetClass; symbol?: string; refresh?: boolean; cacheTtlMs?: number },
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
    const detail = await requestWithTimeout<FlowDetail>(
      state,
      "finance.flow.detail",
      withCacheControl(
        {
          symbol,
          assetClass,
          locale: "US",
          provider: "openbb",
          providerOrder: Array.from(FLOW_PROVIDER_ORDER),
        },
        opts,
      ),
    );
    state.flowRadarDetail = detail ?? null;
  } catch (err) {
    state.flowRadarError = String(err);
  } finally {
    state.flowRadarDetailLoading = false;
  }
}
