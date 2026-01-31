import { getMarketDataFromIntent } from "../../data/marketDataService.js";
import { transformSeriesToMarketData } from "../../data/marketDataTransform.js";
import type { MarketSeries } from "../../data/types.js";
import type { ToolContext, ToolResult, ToolSpec } from "../../tools/types.js";

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

export const marketFetchTool: ToolSpec = {
    name: "market_fetch",
    description: "Fetch market data and compute indicators from live sources",
    version: "1.0.0",
    tags: ["market", "data"],
    inputSchema: {
        type: "object",
        properties: {
            asset: { type: "string" },
            market: { type: "string" },
            timeframes: { type: "array", items: { type: "string" } },
            mode: { type: "string", enum: ["auto", "api", "scrape"] },
            enableSearch: { type: "boolean" },
        },
        required: ["asset", "market", "timeframes"],
    },
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
            mode: asString(input.mode) as "auto" | "api" | "scrape" | undefined,
            enableSearch: asBoolean(input.enableSearch),
        };

        const marketData = await getMarketDataFromIntent(intent, dataOptions);
        return { ok: true, output: JSON.stringify(marketData, null, 2), data: marketData };
    },
};

export const indicatorsComputeTool: ToolSpec = {
    name: "indicators_compute",
    description: "Compute market indicators from OHLCV series",
    version: "1.0.0",
    tags: ["market", "analysis"],
    inputSchema: {
        type: "object",
        properties: {
            series: { type: "array", items: { type: "object" } },
        },
        required: ["series"],
    },
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

export default [marketFetchTool, indicatorsComputeTool];
