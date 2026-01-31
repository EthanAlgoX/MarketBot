// Web analysis command - search and analyze web content

import { loadConfig } from "../../config/io.js";
import { createProviderFromConfig } from "../../core/providers/registry.js";
import { runWebDataAnalyzer, marketWebAnalysis } from "../../agents/webDataAnalyzer.js";
import { resolveSymbolFromText } from "../../utils/symbols.js";

export interface WebAnalyzeOptions {
    query?: string;
    asset?: string;
    json?: boolean;
}

export async function webAnalyzeCommand(options: WebAnalyzeOptions): Promise<void> {
    const config = await loadConfig();
    const provider = createProviderFromConfig(config);

    const query = options.query || options.asset;
    const assetHint = options.asset || query || "";
    const resolvedAsset = resolveSymbolFromText(assetHint) || options.asset;
    if (!query) {
        console.error("Error: Please provide a query or asset to analyze.");
        console.log("Usage: marketbot web-analyze <query>");
        console.log("   or: marketbot web-analyze --asset BTC");
        process.exit(1);
    }

    console.log(`🔍 Searching and analyzing: ${query}...`);
    console.log("");

    try {
        let result;
        if (resolvedAsset) {
            result = await marketWebAnalysis(provider, resolvedAsset, {
                search: config.web?.search,
                fetch: config.web?.fetch,
            });
        } else {
            result = await runWebDataAnalyzer(
                provider,
                { query },
                {
                    search: config.web?.search,
                    fetch: config.web?.fetch,
                },
            );
        }

        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log(result.report);
            console.log("");
            console.log(`⏱️  Completed in ${(result.tookMs / 1000).toFixed(1)}s`);
            console.log(`📚 Sources: ${result.analysis.sources.length}`);
        }
    } catch (error) {
        console.error("Web analysis failed:", error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
