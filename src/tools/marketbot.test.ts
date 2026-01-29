import { describe, expect, it, vi } from "vitest";

import { createMarketBotTools } from "./marketbot.js";
import type { ToolContext } from "./types.js";

const buildContext = (rawArgs: string): ToolContext => ({
  rawArgs,
  args: rawArgs ? rawArgs.split(/\s+/) : [],
  json: rawArgs ? JSON.parse(rawArgs) : undefined,
  cwd: process.cwd(),
  env: process.env,
});

describe("marketbot tools", () => {
  it("market_fetch returns market data", async () => {
    const tools = createMarketBotTools();
    const tool = tools.find((entry) => entry.name === "market_fetch");
    expect(tool).toBeTruthy();

    const context = buildContext(
      JSON.stringify({ asset: "BTC", market: "crypto", timeframes: ["1h", "4h"], mode: "mock" }),
    );

    const result = await tool!.run(context);
    expect(result.ok).toBe(true);
    expect(result.data).toBeTruthy();
  });

  it("indicators_compute computes market data", async () => {
    const tools = createMarketBotTools();
    const tool = tools.find((entry) => entry.name === "indicators_compute");
    expect(tool).toBeTruthy();

    const series = [
      {
        timeframe: "1h",
        candles: [
          { time: 1, open: 1, high: 2, low: 1, close: 2, volume: 10 },
          { time: 2, open: 2, high: 3, low: 2, close: 3, volume: 12 },
          { time: 3, open: 3, high: 4, low: 3, close: 4, volume: 14 },
          { time: 4, open: 4, high: 5, low: 4, close: 5, volume: 16 },
        ],
        source: "test",
      },
      {
        timeframe: "4h",
        candles: [
          { time: 1, open: 1, high: 2, low: 1, close: 2, volume: 10 },
          { time: 2, open: 2, high: 3, low: 2, close: 3, volume: 12 },
          { time: 3, open: 3, high: 4, low: 3, close: 4, volume: 14 },
          { time: 4, open: 4, high: 5, low: 4, close: 5, volume: 16 },
        ],
        source: "test",
      },
    ];

    const context = buildContext(JSON.stringify({ series }));
    const result = await tool!.run(context);
    expect(result.ok).toBe(true);
    expect(result.data).toBeTruthy();
  });

  it("report_render returns report text", async () => {
    const tools = createMarketBotTools();
    const tool = tools.find((entry) => entry.name === "report_render");
    expect(tool).toBeTruthy();

    const marketData = {
      price_structure: { trend_1h: "up", trend_4h: "range" },
      indicators: {
        ema_alignment: "bullish",
        rsi_1h: 62,
        atr_change: "increasing",
        volume_state: "expanding",
      },
    };

    const context = buildContext(JSON.stringify({ userQuery: "Analyze BTC", marketData }));
    const result = await tool!.run(context);
    expect(result.ok).toBe(true);
    expect(typeof result.output).toBe("string");
  });

  it("report_render uses configured provider", async () => {
    const tools = createMarketBotTools();
    const tool = tools.find((entry) => entry.name === "report_render");
    expect(tool).toBeTruthy();

    const marketData = {
      price_structure: { trend_1h: "up", trend_4h: "range" },
      indicators: {
        ema_alignment: "bullish",
        rsi_1h: 62,
        atr_change: "increasing",
        volume_state: "expanding",
      },
    };

    const registryModule = await import("../core/providers/registry.js");
    const spy = vi.spyOn(registryModule, "createProviderFromConfig");
    const context = buildContext(JSON.stringify({ userQuery: "Analyze BTC", marketData }));
    await tool!.run(context);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("market_summary returns concise summary", async () => {
    const tools = createMarketBotTools();
    const tool = tools.find((entry) => entry.name === "market_summary");
    expect(tool).toBeTruthy();

    const marketData = {
      price_structure: { trend_1h: "up", trend_4h: "range" },
      indicators: {
        ema_alignment: "bullish",
        rsi_1h: 62,
        atr_change: "increasing",
        volume_state: "expanding",
      },
    };

    const context = buildContext(JSON.stringify({ asset: "BTC", marketData }));
    const result = await tool!.run(context);
    expect(result.ok).toBe(true);
    expect(typeof result.output).toBe("string");
    expect(result.output).toContain("BTC");
    expect(result.data).toBeTruthy();
  });
});
