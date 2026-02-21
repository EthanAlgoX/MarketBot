import { render } from "lit";
import { describe, expect, it, vi } from "vitest";

import { renderStocks, type StocksProps } from "./stocks";
import type { DailyStockRunResult } from "../types";

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

function createRunResult(
  overrides: Partial<DailyStockRunResult> = {},
  markdown = "",
): DailyStockRunResult {
  return {
    dateIso: "2026-02-21",
    timeframe: "6mo",
    reportType: "simple",
    symbols: ["AAPL", "NVDA"],
    counts: { buy: 1, watch: 1, sell: 0, failed: 0 },
    items: [
      {
        ok: true,
        symbolInput: "AAPL",
        symbol: "AAPL",
        markdown,
      },
      {
        ok: true,
        symbolInput: "NVDA",
        symbol: "NVDA",
        markdown: "## NVDA 决策仪表盘\n- 结论: NVDA 偏观望\n- 建议: WATCH (confidence=medium)",
      },
    ],
    reportMarkdown: markdown,
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

  it("submits quick analyze and prepends normalized symbol into watchlist", () => {
    const container = document.createElement("div");
    const onWatchlistTextChange = vi.fn();
    const onRun = vi.fn();
    render(
      renderStocks(
        createProps({
          watchlistText: "AAPL\nNVDA",
          onWatchlistTextChange,
          onRun,
        }),
      ),
      container,
    );

    const form = container.querySelector("form.stocks-command-bar");
    const input = container.querySelector('input[name="symbol"]') as HTMLInputElement | null;
    expect(form).toBeTruthy();
    expect(input).toBeTruthy();

    input!.value = "tsla";
    form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(onWatchlistTextChange).toHaveBeenCalledWith("TSLA\nAAPL\nNVDA");
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("submits quick analyze without duplicating existing symbol", () => {
    const container = document.createElement("div");
    const onWatchlistTextChange = vi.fn();
    const onRun = vi.fn();
    render(
      renderStocks(
        createProps({
          watchlistText: "AAPL\nNVDA",
          onWatchlistTextChange,
          onRun,
        }),
      ),
      container,
    );

    const form = container.querySelector("form.stocks-command-bar");
    const input = container.querySelector('input[name="symbol"]') as HTMLInputElement | null;
    expect(form).toBeTruthy();
    expect(input).toBeTruthy();

    input!.value = "aapl";
    form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(onWatchlistTextChange).not.toHaveBeenCalled();
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("renders parsed dashboard insight, strategy points and news link", () => {
    const container = document.createElement("div");
    const markdown = [
      "## AAPL 决策仪表盘",
      "- 截至: 2026-02-21T10:00:00.000Z",
      "- 现价: 210 USD",
      "- 结论: AAPL 偏买入，趋势完好",
      "- 建议: BUY (confidence=high)",
      "- 点位: entry=205, stop=198, t1=220, t2=228",
      "",
      "### Checklist",
      "- ✅ ma_alignment: MA5>MA10>MA20 多头排列",
      "",
      "### News",
      "- 2026-02-20 Apple launches new chip",
      "  https://example.com/apple-chip",
    ].join("\n");
    const last = createRunResult({ reportType: "full" }, markdown);

    render(
      renderStocks(
        createProps({
          last,
        }),
      ),
      container,
    );

    expect(container.textContent).toContain("AAPL 偏买入，趋势完好");
    expect(container.textContent).toContain("BUY (confidence=high)");

    const levelValues = Array.from(container.querySelectorAll(".stocks-level-value")).map((el) =>
      el.textContent?.trim(),
    );
    expect(levelValues).toEqual(["205", "228", "198", "220"]);

    const intelLink = container.querySelector('.stocks-intel-link[href="https://example.com/apple-chip"]');
    expect(intelLink).toBeTruthy();
  });

  it("renders queue status and sentiment score from run counts", () => {
    const container = document.createElement("div");
    const last = createRunResult(
      {
        symbols: ["AAPL", "NVDA", "TSLA"],
        counts: { buy: 2, watch: 1, sell: 1, failed: 1 },
        items: [
          {
            ok: true,
            symbolInput: "AAPL",
            symbol: "AAPL",
            markdown: "## AAPL 决策仪表盘\n- 结论: AAPL 偏观望\n- 建议: WATCH (confidence=medium)",
          },
          {
            ok: false,
            symbolInput: "NVDA",
            symbol: "NVDA",
            error: "fetch failed",
          },
        ],
      },
      "## AAPL 决策仪表盘\n- 结论: AAPL 偏观望\n- 建议: WATCH (confidence=medium)",
    );

    render(
      renderStocks(
        createProps({
          watchlistText: "AAPL\nNVDA\nTSLA",
          last,
        }),
      ),
      container,
    );

    const queueStatuses = Array.from(container.querySelectorAll(".stocks-queue-status")).map((el) =>
      el.textContent?.trim(),
    );
    expect(queueStatuses).toEqual(["done", "failed", "pending"]);

    expect(container.querySelector(".stocks-sentiment-score")?.textContent?.trim()).toBe("68");
    expect(container.querySelector(".stocks-sentiment-label")?.textContent?.trim()).toBe("Risk-On");
  });
});
