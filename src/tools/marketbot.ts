import { loadConfig } from "../config/io.js";
import { createProviderFromConfig } from "../core/providers/registry.js";
import { runMarketBot } from "../core/pipeline.js";
import type { MarketDataInput } from "../core/types.js";
import { getMarketDataFromIntent } from "../data/marketDataService.js";
import { transformSeriesToMarketData } from "../data/marketDataTransform.js";
import type { MarketSeries } from "../data/types.js";
import type { ToolContext, ToolResult, ToolSpec } from "./types.js";

import { tradingSignalTools } from "../skills/trading/signal.js";
import { portfolioTools } from "../skills/portfolio/tracker.js";

export function createMarketBotTools(): ToolSpec[] {
  return [
    marketFetchTool(),
    indicatorsComputeTool(),
    reportRenderTool(),
    marketSummaryTool(),
    ...tradingSignalTools(),
    ...portfolioTools()
  ];
}

function marketFetchTool(): ToolSpec {
  return {
    name: "market_fetch",
    description: "Fetch market data and compute indicators from live sources",
    run: async (context: ToolContext): Promise<ToolResult> => {
      const input = requireJson(context);
      const asset = asString(input.asset);
      const market = asString(input.market) as "crypto" | "forex" | "stocks" | "commodities" | "futures";
      const timeframes = asStringArray(input.timeframes);
      if (!asset || !market || timeframes.length === 0) {
        return { ok: false, output: "market_fetch requires asset, market, timeframes[]" };
      }

      const intent = {
        asset,
        market,
        analysis_goal: "risk_check" as const,
        timeframes,
        risk_tolerance: "medium" as const,
        confidence_level: "exploratory" as const,
      };

      const dataOptions = {
        mode: asString(input.mode) as "mock" | "auto" | "api" | "scrape" | undefined,
        enableSearch: asBoolean(input.enableSearch),
      };

      const marketData = await getMarketDataFromIntent(intent, dataOptions);
      return { ok: true, output: JSON.stringify(marketData, null, 2), data: marketData };
    },
  };
}

function indicatorsComputeTool(): ToolSpec {
  return {
    name: "indicators_compute",
    description: "Compute market indicators from OHLCV series",
    run: async (context: ToolContext): Promise<ToolResult> => {
      const input = requireJson(context);
      const series = input.series as MarketSeries[] | undefined;
      if (!series || !Array.isArray(series)) {
        return { ok: false, output: "indicators_compute requires series[]" };
      }
      const marketData = transformSeriesToMarketData(series);
      return { ok: true, output: JSON.stringify(marketData, null, 2), data: marketData };
    },
  };
}

function reportRenderTool(): ToolSpec {
  return {
    name: "report_render",
    description: "Run MarketBot report generation from provided market data",
    run: async (context: ToolContext): Promise<ToolResult> => {
      const input = requireJson(context);
      const userQuery = asString(input.userQuery);
      const marketData = input.marketData as MarketDataInput | undefined;
      const agentId = asString(input.agentId);
      if (!userQuery || !marketData) {
        return { ok: false, output: "report_render requires userQuery and marketData" };
      }

      const config = await loadConfig(process.cwd(), { validate: true });
      const provider = createProviderFromConfig(config);
      const outputs = await runMarketBot({
        userQuery,
        marketData,
        provider,
        agentId: agentId ?? undefined,
      });
      return { ok: true, output: outputs.report, data: outputs };
    },
  };
}

function marketSummaryTool(): ToolSpec {
  return {
    name: "market_summary",
    description: "Summarize market data into a concise text summary",
    run: async (context: ToolContext): Promise<ToolResult> => {
      const input = requireJson(context);
      const marketData = input.marketData as MarketDataInput | undefined;
      const asset = asString(input.asset);
      if (!marketData) {
        return { ok: false, output: "market_summary requires marketData" };
      }

      const trend1h = marketData.price_structure?.trend_1h ?? "range";
      const trend4h = marketData.price_structure?.trend_4h ?? "range";
      const ema = marketData.indicators?.ema_alignment ?? "neutral";
      const rsi = marketData.indicators?.rsi_1h;
      const atr = marketData.indicators?.atr_change ?? "stable";
      const volume = marketData.indicators?.volume_state ?? "stable";

      const momentum = rsi !== undefined
        ? rsi >= 60
          ? "strengthening"
          : rsi <= 40
            ? "weakening"
            : "neutral"
        : "neutral";

      const rsiNote = rsi !== undefined
        ? rsi >= 70
          ? "RSI high"
          : rsi <= 30
            ? "RSI low"
            : "RSI mid"
        : "RSI n/a";

      const prefix = asset ? `${asset}: ` : "";
      const summary = [
        `${prefix}Structure 1h=${trend1h}, 4h=${trend4h}.`,
        `EMA ${ema}, momentum ${momentum}, ${rsiNote} (${rsi ?? "n/a"}).`,
        `Volatility ${atr}, volume ${volume}.`,
      ].join(" ");

      return { ok: true, output: summary, data: { trend1h, trend4h, ema, rsi, atr, volume } };
    },
  };
}

function requireJson(context: ToolContext): Record<string, unknown> {
  if (!context.json || typeof context.json !== "object") {
    throw new Error("Tool expects JSON input.");
  }
  return context.json as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return undefined;
}
