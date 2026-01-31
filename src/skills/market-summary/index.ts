import type { MarketDataInput } from "../../core/types.js";
import type { ToolContext, ToolResult, ToolSpec } from "../../tools/types.js";

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return undefined;
}

function requireJson(context: ToolContext): Record<string, unknown> {
    if (!context.json || typeof context.json !== "object") {
        throw new Error("Tool expects JSON input.");
    }
    return context.json as Record<string, unknown>;
}

export const marketSummaryTool: ToolSpec = {
    name: "market_summary",
    description: "Summarize market data into a concise text summary",
    version: "1.0.0",
    tags: ["summary"],
    inputSchema: {
        type: "object",
        properties: {
            marketData: { type: "object" },
            asset: { type: "string" },
        },
        required: ["marketData"],
    },
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

export default [marketSummaryTool];
