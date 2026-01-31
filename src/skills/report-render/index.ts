import { loadConfig } from "../../config/io.js";
import { createProviderFromConfigAsync } from "../../core/providers/registry.js";
import { runMarketBot } from "../../core/pipeline.js";
import type { MarketDataInput } from "../../core/types.js";
import type { ToolContext, ToolResult, ToolSpec } from "../../tools/types.js";

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function requireJson(context: ToolContext): Record<string, unknown> {
    if (!context.json || typeof context.json !== "object") {
        throw new Error("Tool expects JSON input.");
    }
    return context.json as Record<string, unknown>;
}

export const reportRenderTool: ToolSpec = {
    name: "report_render",
    description: "Run MarketBot report generation from provided market data",
    version: "1.0.0",
    tags: ["report"],
    inputSchema: {
        type: "object",
        properties: {
            userQuery: { type: "string" },
            marketData: { type: "object" },
            agentId: { type: "string" },
        },
        required: ["userQuery", "marketData"],
    },
    run: async (context: ToolContext): Promise<ToolResult> => {
        const input = requireJson(context);
        const userQuery = asString(input.userQuery);
        const marketData = input.marketData as MarketDataInput | undefined;
        const agentId = asString(input.agentId);
        if (!userQuery || !marketData) {
            return { ok: false, output: "report_render requires userQuery and marketData" };
        }

        const config = await loadConfig(process.cwd(), { validate: true });
        const provider = await createProviderFromConfigAsync(config);
        const outputs = await runMarketBot({
            userQuery,
            marketData,
            provider,
            agentId: agentId ?? undefined,
        });
        return { ok: true, output: outputs.report, data: outputs };
    },
};

export default [reportRenderTool];
