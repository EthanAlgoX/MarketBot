import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("../infra/fetch.js", () => ({
  resolveFetch: () => mocks.fetchMock,
}));

import type { MarketBotConfig } from "../config/config.js";
import { createFinanceProviderRegistry } from "./providers.js";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function buildConfig(overrides?: {
  providerByAction?: {
    market_data?: string;
    quote?: string;
    fundamentals?: string;
    news?: string;
  };
}): MarketBotConfig {
  return {
    finance: {
      providers: {
        openbb: {
          enabled: true,
          baseUrl: "http://openbb.local/api/v1",
          provider: "yfinance",
          ...(overrides?.providerByAction ? { providerByAction: overrides.providerByAction } : {}),
          timeoutMs: 5000,
        },
      },
    },
  };
}

describe("openbb finance provider", () => {
  beforeEach(() => {
    mocks.fetchMock.mockReset();
  });

  it("batches quote symbols and preserves input order", async () => {
    mocks.fetchMock.mockImplementation(async (input: unknown) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/equity/price/quote") {
        return jsonResponse({
          results: [
            { symbol: "AAPL", price: 200 },
            { symbol: "MSFT", price: 100 },
          ],
        });
      }
      throw new Error(`unexpected path ${url.pathname}`);
    });

    const openbb = createFinanceProviderRegistry(buildConfig()).get("openbb");
    expect(openbb).toBeDefined();

    const quotes = await openbb!.getQuotes!(["MSFT", "AAPL"], {});

    expect(quotes).toHaveLength(2);
    expect(quotes[0]?.symbol).toBe("MSFT");
    expect(quotes[0]?.regularMarketPrice).toBe(100);
    expect(quotes[1]?.symbol).toBe("AAPL");
    expect(quotes[1]?.regularMarketPrice).toBe(200);

    expect(mocks.fetchMock).toHaveBeenCalledTimes(1);
    const firstUrl = new URL(String(mocks.fetchMock.mock.calls[0]?.[0]));
    expect(firstUrl.pathname).toBe("/api/v1/equity/price/quote");
    expect(firstUrl.searchParams.get("symbol")).toBe("MSFT,AAPL");
  });

  it("maps openbb fundamentals metrics into MarketBot fundamentals", async () => {
    mocks.fetchMock.mockImplementation(async (input: unknown) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/equity/fundamental/metrics") {
        return jsonResponse({
          results: [
            {
              symbol: "AAPL",
              market_cap: 3_000_000_000_000,
              pe_ratio: 31,
              dividend_yield: 1.2,
              return_on_equity: 18,
              shares_outstanding: 15_000_000_000,
              fiscal_year_end: "2025-09-30",
            },
          ],
        });
      }
      throw new Error(`unexpected path ${url.pathname}`);
    });

    const openbb = createFinanceProviderRegistry(buildConfig()).get("openbb");
    const fundamentals = await openbb!.getFundamentals!("AAPL", {});

    expect(fundamentals.symbol).toBe("AAPL");
    expect(fundamentals.marketCap).toBe(3_000_000_000_000);
    expect(fundamentals.trailingPE).toBe(31);
    expect(fundamentals.dividendYield).toBe(0.012);
    expect(fundamentals.returnOnEquity).toBe(0.18);
    expect(fundamentals.sharesOutstanding).toBe(15_000_000_000);
    expect(typeof fundamentals.lastFiscalYearEnd).toBe("number");
  });

  it("falls back from company news to world news when company request fails", async () => {
    mocks.fetchMock.mockImplementation(async (input: unknown) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/news/company") {
        return jsonResponse({ error: "company failed" }, 500);
      }
      if (url.pathname === "/api/v1/news/world") {
        return jsonResponse({
          results: [
            {
              title: "AI market update",
              url: "https://example.com/ai-news",
              source: "ExampleWire",
              published_at: "2026-02-12T12:00:00Z",
            },
          ],
        });
      }
      throw new Error(`unexpected path ${url.pathname}`);
    });

    const openbb = createFinanceProviderRegistry(buildConfig()).get("openbb");
    const news = await openbb!.getNews!({ query: "AI trends", limit: 5 }, {});

    expect(news).toHaveLength(1);
    expect(news[0]?.title).toBe("AI market update");
    expect(news[0]?.link).toBe("https://example.com/ai-news");
    expect(news[0]?.source).toBe("ExampleWire");

    const paths = mocks.fetchMock.mock.calls.map((call) => new URL(String(call[0])).pathname);
    expect(paths).toContain("/api/v1/news/company");
    expect(paths).toContain("/api/v1/news/world");
  });

  it("uses action-specific provider overrides when configured", async () => {
    mocks.fetchMock.mockImplementation(async (input: unknown) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/v1/equity/price/quote") {
        return jsonResponse({ results: [{ symbol: "AAPL", price: 200 }] });
      }
      if (url.pathname === "/api/v1/equity/fundamental/metrics") {
        return jsonResponse({ results: [{ symbol: "AAPL", pe_ratio: 30 }] });
      }
      if (url.pathname === "/api/v1/news/company") {
        return jsonResponse({
          results: [{ title: "Apple headline", url: "https://example.com/apple-news" }],
        });
      }
      throw new Error(`unexpected path ${url.pathname}`);
    });

    const openbb = createFinanceProviderRegistry(
      buildConfig({
        providerByAction: {
          quote: "fmp",
          fundamentals: "intrinio",
          news: "benzinga",
        },
      }),
    ).get("openbb");

    await openbb!.getQuotes!(["AAPL"], {});
    await openbb!.getFundamentals!("AAPL", {});
    await openbb!.getNews!({ query: "AAPL", limit: 5 }, {});

    const quoteUrl = new URL(String(mocks.fetchMock.mock.calls[0]?.[0]));
    const fundamentalsUrl = new URL(String(mocks.fetchMock.mock.calls[1]?.[0]));
    const newsUrl = new URL(String(mocks.fetchMock.mock.calls[2]?.[0]));

    expect(quoteUrl.searchParams.get("provider")).toBe("fmp");
    expect(fundamentalsUrl.searchParams.get("provider")).toBe("intrinio");
    expect(newsUrl.searchParams.get("provider")).toBe("benzinga");
  });
});
