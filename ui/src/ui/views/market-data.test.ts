import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

import { renderMarketData, type MarketDataProps } from "./market-data";

function createProps(overrides: Partial<MarketDataProps> = {}): MarketDataProps {
  return {
    language: "en",
    loading: false,
    error: null,
    symbolsText: "AAPL\nMSFT\nNVDA",
    timeframe: "6mo",
    newsLimit: "5",
    activeSymbol: "AAPL",
    status: {
      nowIso: "2026-02-20T00:00:00.000Z",
      engine: {
        name: "market-data",
        openbb: {
          enabled: true,
          configured: true,
          connected: true,
          baseUrl: "http://127.0.0.1:6900/api/v1",
          provider: "yfinance",
          error: null,
        },
      },
    },
    snapshot: {
      nowIso: "2026-02-20T00:00:00.000Z",
      symbols: ["AAPL", "MSFT"],
      timeframe: "6mo",
      locale: "US",
      provider: "openbb",
      activeSymbol: "AAPL",
      items: [
        {
          symbol: "AAPL",
          source: "openbb",
          price: 191.23,
          changePercent: 1.25,
          marketTimeIso: "2026-02-20T00:00:00.000Z",
          points: [
            { ts: 1700000000000, iso: "2023-11-14T00:00:00.000Z", close: 190 },
            { ts: 1700003600000, iso: "2023-11-14T01:00:00.000Z", close: 191.23 },
          ],
          error: null,
        },
        {
          symbol: "MSFT",
          source: "openbb",
          price: 432.77,
          changePercent: -0.55,
          marketTimeIso: "2026-02-20T00:00:00.000Z",
          points: [
            { ts: 1700000000000, iso: "2023-11-14T00:00:00.000Z", close: 435 },
            { ts: 1700003600000, iso: "2023-11-14T01:00:00.000Z", close: 432.77 },
          ],
          error: null,
        },
      ],
      news: [
        {
          title: "Apple AI roadmap update",
          link: "https://example.com/news/apple",
          source: "Example",
          pubDate: "2026-02-20T00:00:00.000Z",
        },
      ],
      fundamentals: {
        symbol: "AAPL",
        marketCap: 3.2e12,
        trailingPE: 29.1,
      },
      warnings: [],
    },
    onSymbolsTextChange: () => undefined,
    onTimeframeChange: () => undefined,
    onNewsLimitChange: () => undefined,
    onActiveSymbolChange: () => undefined,
    onApplyMag7: () => undefined,
    onRefreshStatus: () => undefined,
    onRun: () => undefined,
    ...overrides,
  };
}

describe("market-data view", () => {
  it("renders core sections and warning callout", () => {
    const container = document.createElement("div");
    render(
      renderMarketData(
        createProps({
          snapshot: {
            ...createProps().snapshot!,
            warnings: ["quotes unavailable: connector timeout"],
          },
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("Data Engine Status");
    expect(container.textContent).toContain("Snapshot");
    expect(container.textContent).toContain("Price Trend");
    expect(container.textContent).toContain("quotes unavailable");
  });

  it("triggers active symbol change when clicking summary row", () => {
    const container = document.createElement("div");
    const onActiveSymbolChange = vi.fn();
    render(
      renderMarketData(
        createProps({
          onActiveSymbolChange,
        }),
      ),
      container,
    );

    const msftRow = Array.from(container.querySelectorAll("button")).find(
      (entry) => entry.textContent?.includes("MSFT"),
    );
    expect(msftRow).toBeDefined();
    msftRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onActiveSymbolChange).toHaveBeenCalledWith("MSFT");
  });

  it("triggers quick action buttons", () => {
    const container = document.createElement("div");
    const onApplyMag7 = vi.fn();
    const onRefreshStatus = vi.fn();
    const onRun = vi.fn();
    render(
      renderMarketData(
        createProps({
          onApplyMag7,
          onRefreshStatus,
          onRun,
        }),
      ),
      container,
    );

    const buttons = Array.from(container.querySelectorAll("button"));
    const mag7 = buttons.find((button) => button.textContent?.trim() === "Use Magnificent Seven");
    const refresh = buttons.find((button) => button.textContent?.trim() === "Refresh Status");
    const run = buttons.find((button) => button.textContent?.trim() === "Load Data");
    mag7?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    refresh?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    run?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onApplyMag7).toHaveBeenCalledTimes(1);
    expect(onRefreshStatus).toHaveBeenCalledTimes(1);
    expect(onRun).toHaveBeenCalledTimes(1);
  });
});
