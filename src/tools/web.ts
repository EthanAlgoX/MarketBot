import type { ToolSpec, ToolContext, ToolResult } from "./types.js";
import { webSearch } from "../web/webSearch.js";

export function createWebTools(): ToolSpec[] {
    return [
        webSearchTool()
    ];
}

function webSearchTool(): ToolSpec {
    return {
        name: "web_search",
        description: "Search the web for information using a query. Arguments: query (string)",
        run: async (context: ToolContext): Promise<ToolResult> => {
            let query = "";

            // Handle different input formats (raw string vs JSON)
            const input = context.json as { query?: unknown } | undefined;
            if (input && typeof input.query === "string") {
                query = input.query;
            } else {
                query = context.rawArgs.trim();
            }

            if (!query) {
                return { ok: false, output: "Missing query" };
            }

            try {
                const result = await webSearch(query, {
                    // Default config, can be improved by reading from context/config if needed
                    provider: "browser"
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
