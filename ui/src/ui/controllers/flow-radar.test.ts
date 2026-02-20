import { describe, expect, it, vi } from "vitest";

import {
  loadFlowRadarDetail,
  runFlowRadarSnapshot,
  type FlowRadarState,
} from "./flow-radar";

function createState(overrides: Partial<FlowRadarState> = {}): FlowRadarState {
  return {
    client: null,
    connected: true,
    flowRadarLoading: false,
    flowRadarDetailLoading: false,
    flowRadarError: null,
    flowRadarSnapshot: null,
    flowRadarActiveAssetClass: null,
    flowRadarActiveSymbol: null,
    flowRadarDetail: null,
    ...overrides,
  };
}

describe("flow-radar controller", () => {
  it("loads snapshot and then detail with default selection", async () => {
    const request = vi.fn(async (method: string) => {
      if (method === "finance.flow.snapshot") {
        return {
          nowIso: "2026-02-20T00:00:00.000Z",
          provider: "openbb",
          locale: "US",
          topN: 10,
          overview: {
            asOfIso: "2026-02-20T00:00:00.000Z",
            liquidityRegime: "balanced",
            summary: "balanced",
            fedSignal: "fed",
            bojSignal: "boj",
            metrics: [],
            assetFlows: [],
          },
          buckets: [
            {
              assetClass: "usStocks",
              label: "US",
              items: [
                {
                  symbol: "NVDA",
                  name: "NVIDIA",
                  price: 100,
                  changePercent: 2,
                  currency: "USD",
                  exchange: "NASDAQ",
                  marketTimeIso: "2026-02-20T00:00:00.000Z",
                  reason: "momentum",
                  headline: null,
                },
              ],
            },
          ],
          warnings: [],
        };
      }
      if (method === "finance.flow.detail") {
        return {
          symbol: "NVDA",
          assetClass: "usStocks",
          nowIso: "2026-02-20T00:01:00.000Z",
          price: 100,
          changePercent: 2,
          marketTimeIso: "2026-02-20T00:00:00.000Z",
          points: [],
          analysis: {
            trend: "up",
            changePercent7d: 3,
            volatilityPercent: 1,
            summary: "uptrend",
          },
          news: [],
          warnings: [],
        };
      }
      return {};
    });
    const state = createState({
      client: {
        request,
      } as any,
    });

    await runFlowRadarSnapshot(state);

    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[0]).toBe("finance.flow.snapshot");
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      providerOrder: ["openbb", "yahoo", "stooq", "google-news"],
    });
    expect(request.mock.calls[1]?.[0]).toBe("finance.flow.detail");
    expect(state.flowRadarActiveAssetClass).toBe("usStocks");
    expect(state.flowRadarActiveSymbol).toBe("NVDA");
    expect(state.flowRadarDetail?.symbol).toBe("NVDA");
    expect(state.flowRadarLoading).toBe(false);
    expect(state.flowRadarDetailLoading).toBe(false);
  });

  it("loads detail with explicit selection", async () => {
    const request = vi.fn(async () => ({
      symbol: "GC=F",
      assetClass: "metals",
      nowIso: "2026-02-20T00:01:00.000Z",
      price: 2500,
      changePercent: 1.2,
      marketTimeIso: "2026-02-20T00:00:00.000Z",
      points: [],
      analysis: {
        trend: "up",
        changePercent7d: 0.9,
        volatilityPercent: 0.4,
        summary: "steady",
      },
      news: [],
      warnings: [],
    }));
    const state = createState({
      client: {
        request,
      } as any,
    });

    await loadFlowRadarDetail(state, {
      assetClass: "metals",
      symbol: "gc=f",
    });

    expect(request).toHaveBeenCalledWith("finance.flow.detail", {
      symbol: "GC=F",
      assetClass: "metals",
      locale: "US",
      provider: "openbb",
      providerOrder: ["openbb", "yahoo", "stooq", "google-news"],
    });
    expect(state.flowRadarDetail?.assetClass).toBe("metals");
    expect(state.flowRadarError).toBeNull();
  });
});
