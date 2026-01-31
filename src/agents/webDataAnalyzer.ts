// Web Data Analyzer Agent - orchestrates web search, fetch, and analysis

import type { LLMProvider } from "../core/llm.js";
import { webSearch, searchMarketInfo, type WebSearchConfig, type WebSearchResult } from "../web/webSearch.js";
import { webFetch, type WebFetchConfig, type WebFetchResult } from "../web/webFetch.js";
import { analyzeWebContent, formatAnalysisReport, type WebAnalysisOutput } from "../web/webAnalyze.js";
import { fetchQuoteSnapshot } from "../data/quotes.js";
import { resolveSymbolFromText } from "../utils/symbols.js";

export interface WebDataAnalyzerConfig {
    search?: WebSearchConfig;
    fetch?: WebFetchConfig;
    maxSearchQueries?: number;
    maxFetchUrls?: number;
    fetchCitations?: boolean;
    enableQuoteSnapshot?: boolean;
}

export interface WebDataAnalyzerInput {
    query: string;
    asset?: string;
    topics?: string[];
}

export interface WebDataAnalyzerOutput {
    query: string;
    searchResults: WebSearchResult[];
    fetchedPages: WebFetchResult[];
    analysis: WebAnalysisOutput;
    report: string;
    tookMs: number;
}

/**
 * Web Data Analyzer Agent
 * 
 * Orchestrates the full web analysis pipeline:
 * 1. Search for relevant information
 * 2. Optionally fetch additional pages from citations
 * 3. Analyze all collected content
 * 4. Generate structured report
 */
export async function runWebDataAnalyzer(
    provider: LLMProvider,
    input: WebDataAnalyzerInput,
    config?: WebDataAnalyzerConfig,
): Promise<WebDataAnalyzerOutput> {
    const start = Date.now();
    const searchResults: WebSearchResult[] = [];
    const fetchedPages: WebFetchResult[] = [];

    const resolvedSymbol = resolveSymbolFromText(input.asset ?? "") ?? resolveSymbolFromText(input.query);
    let priceSnapshot;
    if (resolvedSymbol && config?.enableQuoteSnapshot !== false) {
        try {
            priceSnapshot = await fetchQuoteSnapshot(resolvedSymbol);
        } catch (error) {
            console.warn(`Quote fetch failed for ${resolvedSymbol}:`, error);
        }
    }

    // Step 1: Primary search
    try {
        const primaryResult = await webSearch(input.query, config?.search);
        searchResults.push(primaryResult);
    } catch (error) {
        console.warn("Primary search failed:", error);
    }

    // Step 2: Topic-specific searches if asset provided
    if (input.asset && input.topics?.length) {
        const maxQueries = config?.maxSearchQueries ?? 2;
        for (const topic of input.topics.slice(0, maxQueries)) {
            try {
                const result = await searchMarketInfo(input.asset, topic, config?.search);
                searchResults.push(result);
            } catch (error) {
                console.warn(`Topic search failed for "${topic}":`, error);
            }
        }
    }

    // Step 3: Fetch citation URLs if enabled
    if (config?.fetchCitations !== false) {
        const citations = searchResults.flatMap((r) => r.citations || []);
        const uniqueUrls = [...new Set(citations)].slice(0, config?.maxFetchUrls ?? 3);

        for (const url of uniqueUrls) {
            try {
                const page = await webFetch(url, { extractMode: "text", config: config?.fetch });
                fetchedPages.push(page);
            } catch (error) {
                console.warn(`Failed to fetch citation "${url}":`, error);
            }
        }
    }

    // Step 4: Analyze collected content
    const analysis = await analyzeWebContent(provider, {
        query: input.query,
        searchResults,
        fetchedPages,
        priceSnapshot: priceSnapshot ?? undefined,
    });

    // Step 5: Generate report
    const report = formatAnalysisReport(analysis);

    return {
        query: input.query,
        searchResults,
        fetchedPages,
        analysis,
        report,
        tookMs: Date.now() - start,
    };
}

/**
 * Quick web analysis for a simple query.
 */
export async function quickWebAnalysis(
    provider: LLMProvider,
    query: string,
    config?: WebDataAnalyzerConfig,
): Promise<string> {
    const result = await runWebDataAnalyzer(provider, { query }, config);
    return result.report;
}

/**
 * Market-focused web analysis.
 */
export async function marketWebAnalysis(
    provider: LLMProvider,
    asset: string,
    config?: WebDataAnalyzerConfig,
): Promise<WebDataAnalyzerOutput> {
    return runWebDataAnalyzer(
        provider,
        {
            query: `${asset} market analysis latest news price prediction`,
            asset,
            topics: ["price action", "news events", "market sentiment"],
        },
        config,
    );
}
