import { fetchWithTimeout } from "../../data/providers/providerUtils.js";
import type { ToolSpec, ToolContext } from "../../tools/types.js";

export const httpGetTool: ToolSpec = {
    name: "http_get",
    description: "Fetch a URL and return the first 4000 chars",
    version: "1.0.0",
    tags: ["web", "fetch"],
    inputSchema: {
        type: "object",
        properties: {
            url: { type: "string", description: "URL to fetch" },
        },
        required: ["url"],
    },
    run: async (context: ToolContext) => {
        const url = context.rawArgs.trim();
        if (!url) {
            return { ok: false, output: "Missing URL" };
        }
        const response = await fetchWithTimeout(url, { timeout: 10_000 });
        const text = await response.text();
        const output = text.slice(0, 4000);
        return { ok: response.ok, output, data: { status: response.status } };
    },
};

export default [httpGetTool];
