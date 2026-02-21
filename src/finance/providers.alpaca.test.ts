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

function buildConfig(): MarketBotConfig {
  return {
    finance: {
      providers: {
        alpaca: {
          enabled: true,
          baseUrl: "https://data.alpaca.markets/v2",
          apiKey: "test-key",
          secretKey: "test-secret",
          provider: "iex",
          timeoutMs: 5000,
        },
      },
    },
  };
}

describe("alpaca finance provider", () => {
  beforeEach(() => {
    mocks.fetchMock.mockReset();
  });

  it("loads batched snapshots and preserves symbol order", async () => {
    mocks.fetchMock.mockImplementation(async (input: unknown) => {
      const url = new URL(String(input));
      if (url.pathname === "/v2/stocks/snapshots") {
        return jsonResponse({
          snapshots: {
            AAPL: {
              latestTrade: { p: 210.5, t: "2026-02-21T10:30:00Z" },
              prevDailyBar: { c: 205.0 },
            },
            MSFT: {
              latestTrade: { p: 405.2, t: "2026-02-21T10:31:00Z" },
              prevDailyBar: { c: 400.0 },
            },
          },
        });
      }
      throw new Error(`unexpected path ${url.pathname}`);
    });

    const alpaca = createFinanceProviderRegistry(buildConfig()).get("alpaca");
    expect(alpaca).toBeDefined();

    const quotes = await alpaca!.getQuotes!(["MSFT", "AAPL"], {});
    expect(quotes).toHaveLength(2);
    expect(quotes[0]?.symbol).toBe("MSFT");
    expect(quotes[0]?.regularMarketPrice).toBe(405.2);
    expect(quotes[1]?.symbol).toBe("AAPL");
    expect(quotes[1]?.regularMarketPrice).toBe(210.5);

    const requestInit = mocks.fetchMock.mock.calls[0]?.[1] as {
      headers?: Record<string, string>;
    };
    expect(requestInit.headers?.["APCA-API-KEY-ID"]).toBe("test-key");
    expect(requestInit.headers?.["APCA-API-SECRET-KEY"]).toBe("test-secret");
  });

  it("maps bars endpoint into MarketSeries", async () => {
    mocks.fetchMock.mockImplementation(async (input: unknown) => {
      const url = new URL(String(input));
      if (url.pathname === "/v2/stocks/AAPL/bars") {
        return jsonResponse({
          bars: [
            { t: "2026-02-17T00:00:00Z", o: 200, h: 202, l: 198, c: 201, v: 1000 },
            { t: "2026-02-18T00:00:00Z", o: 201, h: 205, l: 200, c: 204, v: 1200 },
            { t: "2026-02-19T00:00:00Z", o: 204, h: 206, l: 203, c: 205, v: 1300 },
          ],
        });
      }
      throw new Error(`unexpected path ${url.pathname}`);
    });

    const alpaca = createFinanceProviderRegistry(buildConfig()).get("alpaca");
    const series = await alpaca!.getMarketData!({ symbol: "AAPL", timeframe: "1mo", limit: 2 }, {});

    expect(series.source).toBe("alpaca");
    expect(series.symbol).toBe("AAPL");
    expect(series.series).toHaveLength(2);
    expect(series.series[0]?.close).toBe(204);
    expect(series.series[1]?.close).toBe(205);

    const barsUrl = new URL(String(mocks.fetchMock.mock.calls[0]?.[0]));
    expect(barsUrl.searchParams.get("timeframe")).toBe("1Day");
    expect(barsUrl.searchParams.get("feed")).toBe("iex");
    expect(barsUrl.searchParams.get("sort")).toBe("desc");
    expect(barsUrl.searchParams.get("start")).toBeTruthy();
    expect(barsUrl.searchParams.get("end")).toBeTruthy();
  });

  it("rejects non-US symbols", async () => {
    const alpaca = createFinanceProviderRegistry(buildConfig()).get("alpaca");
    await expect(alpaca!.getQuotes!(["00700.HK"], {})).rejects.toThrow(
      /supports us equities only/i,
    );
  });
});
