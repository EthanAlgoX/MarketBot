import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

import { renderStocks, type StocksProps } from "./stocks";

function createProps(overrides: Partial<StocksProps> = {}): StocksProps {
  return {
    language: "en",
    loading: false,
    running: false,
    error: null,
    watchlistText: "AAPL\nNVDA",
    timeframe: "6mo",
    reportType: "simple",
    includeFundamentals: false,
    newsLimit: "2",
    locale: "US",
    last: null,
    onWatchlistTextChange: () => undefined,
    onTimeframeChange: () => undefined,
    onReportTypeChange: () => undefined,
    onIncludeFundamentalsChange: () => undefined,
    onNewsLimitChange: () => undefined,
    onLocaleChange: () => undefined,
    onRefresh: () => undefined,
    onSaveWatchlist: () => undefined,
    onRun: () => undefined,
    ...overrides,
  };
}

describe("stocks view", () => {
  it("applies deep preset to existing controls", () => {
    const container = document.createElement("div");
    const onTimeframeChange = vi.fn();
    const onReportTypeChange = vi.fn();
    const onIncludeFundamentalsChange = vi.fn();
    const onNewsLimitChange = vi.fn();
    const onLocaleChange = vi.fn();

    render(
      renderStocks(
        createProps({
          onTimeframeChange,
          onReportTypeChange,
          onIncludeFundamentalsChange,
          onNewsLimitChange,
          onLocaleChange,
        }),
      ),
      container,
    );

    const deepPreset = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "Equity Deep Dive",
    );
    expect(deepPreset).not.toBeUndefined();
    deepPreset?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onTimeframeChange).toHaveBeenCalledWith("1y");
    expect(onReportTypeChange).toHaveBeenCalledWith("full");
    expect(onIncludeFundamentalsChange).toHaveBeenCalledWith(true);
    expect(onNewsLimitChange).toHaveBeenCalledWith("6");
    expect(onLocaleChange).toHaveBeenCalledWith("US");
  });

  it("toggles news source button to zero news limit when active", () => {
    const container = document.createElement("div");
    const onNewsLimitChange = vi.fn();
    render(
      renderStocks(
        createProps({
          newsLimit: "3",
          onNewsLimitChange,
        }),
      ),
      container,
    );

    const toggleNews = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.trim() === "News Feed",
    );
    expect(toggleNews).not.toBeUndefined();
    toggleNews?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onNewsLimitChange).toHaveBeenCalledWith("0");
  });
});

