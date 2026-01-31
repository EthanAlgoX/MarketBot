import type { ToolSpec, ToolContext, ToolResult } from "./types.js";
import { webSearch } from "../web/webSearch.js";
import { loadConfig } from "../config/io.js";

export function createWebTools(): ToolSpec[] {
    return [
        webSearchTool()
    ];
}

function webSearchTool(): ToolSpec {
    return {
        name: "web_search",
        description: "Search the web for information using a query. Arguments: query (string)",
        version: "1.0.0",
        tags: ["web", "search"],
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string" },
                provider: { type: "string", enum: ["browser", "perplexity"] },
                maxResults: { type: "number" },
                headless: { type: "boolean" },
            },
            required: ["query"],
        },
        run: async (context: ToolContext): Promise<ToolResult> => {
            let query = "";

            // Handle different input formats (raw string vs JSON)
            const input = context.json as { query?: unknown; provider?: unknown; maxResults?: unknown; headless?: unknown } | undefined;
            if (input && typeof input.query === "string") {
                query = input.query;
            } else {
                query = context.rawArgs.trim();
            }

            if (!query) {
                return { ok: false, output: "Missing query" };
            }

            try {
                const config = await loadConfig(context.cwd, { validate: true });
                const searchConfig = config.web?.search ?? {};
                const provider = typeof input?.provider === "string" ? input.provider : searchConfig.provider;
                const maxResults = typeof input?.maxResults === "number" ? input.maxResults : searchConfig.maxResults;
                const headless = typeof input?.headless === "boolean" ? input.headless : searchConfig.headless;
                const apiKey = searchConfig.apiKey;
                const apiKeyEnv = searchConfig.apiKeyEnv;

                const result = await webSearch(query, {
                    provider,
                    maxResults,
                    headless,
                    apiKey,
                    apiKeyEnv,
                });

                return {
                    ok: true,
                    output: result.content,
                    data: result
                };
            } catch (err) {
                return {
                    ok: false,
                    output: `Search failed: ${err instanceof Error ? err.message : String(err)}`
                };
            }
        }
    };
}
