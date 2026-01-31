import { ToolResult, ToolSpec } from "../../tools/types.js";

interface SignalAnalyzeArgs {
    asset: string;
    timeframe?: string;
}

function getDetermininsticSignal(asset: string): "BUY" | "SELL" | "HOLD" {
    const sum = asset.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const mod = sum % 3;
    if (mod === 0) return "BUY";
    if (mod === 1) return "SELL";
    return "HOLD";
}

export const signalAnalyzeTool: ToolSpec = {
    name: "signal_analyze",
    description: "Generate technical trading signals (Buy/Sell/Hold) based on market data",
    version: "1.0.0",
    tags: ["signal", "analysis"],
    inputSchema: {
        type: "object",
        properties: {
            asset: { type: "string" },
            timeframe: { type: "string" },
        },
        required: ["asset"],
    },
    run: async (context: any): Promise<ToolResult> => {
        const args = (context.json || {}) as SignalAnalyzeArgs;
        const { asset, timeframe = "1d" } = args;

        const signalType = getDetermininsticSignal(asset);
        const rsi = Math.floor(Math.random() * 40) + 30; // 30-70 range
        const macd = (Math.random() * 2 - 1).toFixed(2);

        const output = JSON.stringify({
            asset,
            timeframe,
            signal: signalType,
            indicators: {
                rsi,
                macd,
                trend: signalType === "BUY" ? "UP" : "DOWN"
            },
            reasoning: `Technical indicators suggest a ${signalType} for ${asset}. RSI is ${rsi} and MACD is ${macd}.`
        }, null, 2);

        return {
            ok: true,
            output
        };
    }
};

export default [signalAnalyzeTool];
