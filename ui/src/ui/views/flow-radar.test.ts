import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

import { renderFlowRadar, type FlowRadarProps } from "./flow-radar";

function createProps(overrides: Partial<FlowRadarProps> = {}): FlowRadarProps {
  return {
    language: "zh",
    loading: false,
    detailLoading: false,
    error: null,
    snapshot: {
      nowIso: "2026-02-20T00:00:00.000Z",
      provider: "openbb",
      locale: "US",
      topN: 10,
      overview: {
        asOfIso: "2026-02-20T00:00:00.000Z",
        liquidityRegime: "risk-on",
        summary: "全球流动性偏宽松。",
        fedSignal: "美债走强。",
        bojSignal: "日元偏强。",
        metrics: [
          {
            key: "qqq",
            label: "US Growth (QQQ)",
            symbol: "QQQ",
            price: 500,
            changePercent: 1.2,
            direction: "inflow",
          },
        ],
        assetFlows: [
          { asset: "equities", label: "Equities", changePercent: 1.1, direction: "inflow" },
          { asset: "metals", label: "Metals", changePercent: 0.6, direction: "inflow" },
          { asset: "crypto", label: "Crypto", changePercent: -0.3, direction: "outflow" },
        ],
      },
      buckets: [
        {
          assetClass: "usStocks",
          label: "US Equities Top Gainers",
          items: [
            {
              symbol: "NVDA",
              name: "NVIDIA",
              price: 900,
              changePercent: 4.1,
              currency: "USD",
              exchange: "NASDAQ",
              marketTimeIso: "2026-02-20T00:00:00.000Z",
              reason: "新闻驱动：AI 需求超预期",
              headline: "AI 需求超预期",
            },
          ],
        },
      ],
      warnings: [],
    },
    detail: {
      symbol: "NVDA",
      assetClass: "usStocks",
      nowIso: "2026-02-20T00:00:00.000Z",
      price: 900,
      changePercent: 4.1,
      marketTimeIso: "2026-02-20T00:00:00.000Z",
      points: [
        { ts: 1700000000000, iso: "2023-11-14T00:00:00.000Z", close: 860 },
        { ts: 1700003600000, iso: "2023-11-14T01:00:00.000Z", close: 900 },
      ],
      analysis: {
        trend: "up",
        changePercent7d: 4.2,
        volatilityPercent: 1.8,
        summary: "最近 7 天趋势向上。",
      },
      news: [
        {
          title: "NVIDIA extends rally on AI demand",
          link: "https://example.com/nvda",
          source: "Example",
          pubDate: "2026-02-20",
        },
      ],
      warnings: [],
    },
    activeAssetClass: "usStocks",
    activeSymbol: "NVDA",
    onRefresh: () => undefined,
    onSelect: () => undefined,
    ...overrides,
  };
}

describe("flow-radar view", () => {
  const runIfDom = typeof document === "undefined" ? it.skip : it;

  runIfDom("renders overview and detail sections", () => {
    const container = document.createElement("div");
    render(renderFlowRadar(createProps()), container);

    expect(container.textContent).toContain("全球流动性脉冲");
    expect(container.textContent).toContain("US Equities Top Gainers");
    expect(container.textContent).toContain("近 7 天走势与分析");
    expect(container.textContent).toContain("NVIDIA extends rally");
  });

  runIfDom("triggers row selection callback", () => {
    const container = document.createElement("div");
    const onSelect = vi.fn();
    render(
      renderFlowRadar(
        createProps({
          onSelect,
        }),
      ),
      container,
    );

    const row = Array.from(container.querySelectorAll("button")).find((entry) =>
      entry.textContent?.includes("NVDA"),
    );
    expect(row).toBeDefined();
    row?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith("usStocks", "NVDA");
  });
});
