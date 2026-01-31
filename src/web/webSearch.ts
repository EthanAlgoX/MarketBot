// Web Search Service - Perplexity Sonar and Browser-based search

import {
    CacheEntry,
    DEFAULT_CACHE_TTL_MINUTES,
    DEFAULT_TIMEOUT_SECONDS,
    normalizeCacheKey,
    readCache,
    readResponseText,
    resolveCacheTtlMs,
    resolveTimeoutSeconds,
    withTimeout,
    writeCache,
} from "./shared.js";
import {
    browserSearchAndScrape,
    type BrowserSearchResult,
    type ScrapedPage,
} from "./browserScraper.js";

const DEFAULT_PERPLEXITY_BASE_URL = "https://api.perplexity.ai";
const DEFAULT_PERPLEXITY_MODEL = "sonar";
const MAX_SEARCH_COUNT = 10;

const SEARCH_CACHE = new Map<string, CacheEntry<WebSearchResult>>();

export interface WebSearchConfig {
    enabled?: boolean;
    provider?: "perplexity" | "browser";
    apiKey?: string;
    apiKeyEnv?: string;
    baseUrl?: string;
    model?: string;
    maxResults?: number;
    timeoutSeconds?: number;
    cacheTtlMinutes?: number;
    headless?: boolean;
}

export interface WebSearchResult {
    query: string;
    provider: string;
    model?: string;
    tookMs: number;
    content: string;
    citations: string[];
    searchResults?: BrowserSearchResult[];
    scrapedPages?: ScrapedPage[];
    cached?: boolean;
}

export interface SearchResultItem {
    title: string;
    url: string;
    snippet: string;
}

function resolveApiKey(config?: WebSearchConfig): string | undefined {
    if (config?.apiKey) return config.apiKey;
    const envName = config?.apiKeyEnv ?? "PERPLEXITY_API_KEY";
    return process.env[envName]?.trim() || undefined;
}

type PerplexitySearchResponse = {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
    citations?: string[];
};

async function runPerplexitySearch(params: {
    query: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    timeoutSeconds: number;
}): Promise<{ content: string; citations: string[] }> {
    const endpoint = `${params.baseUrl.replace(/\/$/, "")}/chat/completions`;

    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify({
            model: params.model,
            messages: [
                {
                    role: "user",
                    content: params.query,
                },
            ],
        }),
        signal: withTimeout(undefined, params.timeoutSeconds * 1000),
    });

    if (!res.ok) {
        const detail = await readResponseText(res);
        throw new Error(`Perplexity API error (${res.status}): ${detail || res.statusText}`);
    }

    const data = (await res.json()) as PerplexitySearchResponse;
    const content = data.choices?.[0]?.message?.content ?? "No response";
    const citations = data.citations ?? [];

    return { content, citations };
}

/**
 * Browser-based web search using Puppeteer
 */
async function runBrowserSearch(params: {
    query: string;
    maxResults: number;
    headless: boolean;
}): Promise<{
    content: string;
    citations: string[];
    searchResults: BrowserSearchResult[];
    scrapedPages: ScrapedPage[];
    tookMs: number;
}> {
    const result = await browserSearchAndScrape(params.query, {
        maxSearchResults: params.maxResults,
        maxPagesToScrape: 3,
        config: { headless: params.headless },
    });

    // Build content from scraped pages
    const contentParts: string[] = [];
    for (const page of result.scrapedPages) {
        contentParts.push(`## ${page.title}\n${page.content.slice(0, 5000)}\n`);
    }

    // Build citations from search results
    const citations = result.searchResults.map((r) => r.url);

    return {
        content: contentParts.join("\n---\n") || "No content scraped",
        citations,
        searchResults: result.searchResults,
        scrapedPages: result.scrapedPages,
        tookMs: result.tookMs,
    };
}

export async function webSearch(
    query: string,
    config?: WebSearchConfig,
): Promise<WebSearchResult> {
    const provider = config?.provider ?? "browser";
    const cacheTtlMs = resolveCacheTtlMs(config?.cacheTtlMinutes, DEFAULT_CACHE_TTL_MINUTES);
    const cacheKey = normalizeCacheKey(`${provider}:${query}`);
    const cached = readCache(SEARCH_CACHE, cacheKey);
    if (cached) return { ...cached.value, cached: true };

    // Use browser-based search by default
    if (provider === "browser") {
        try {
            const maxResults = config?.maxResults ?? 5;
            const headless = config?.headless !== false;
            const browserResult = await runBrowserSearch({
                query,
                maxResults,
                headless,
            });

            const result: WebSearchResult = {
                query,
                provider: "browser",
                tookMs: browserResult.tookMs,
                content: browserResult.content,
                citations: browserResult.citations,
                searchResults: browserResult.searchResults,
                scrapedPages: browserResult.scrapedPages,
            };

            writeCache(SEARCH_CACHE, cacheKey, result, cacheTtlMs);
            return result;
        } catch (err) {
            const apiKey = resolveApiKey(config);
            if (!apiKey) throw err;
            const baseUrl = config?.baseUrl ?? DEFAULT_PERPLEXITY_BASE_URL;
            const model = config?.model ?? DEFAULT_PERPLEXITY_MODEL;
            const timeoutSeconds = resolveTimeoutSeconds(config?.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS);

            const start = Date.now();
            const { content, citations } = await runPerplexitySearch({
                query,
                apiKey,
                baseUrl,
                model,
                timeoutSeconds,
            });

            const result: WebSearchResult = {
                query,
                provider: "perplexity",
                model,
                tookMs: Date.now() - start,
                content,
                citations,
            };

            writeCache(SEARCH_CACHE, normalizeCacheKey(`perplexity:${query}`), result, cacheTtlMs);
            return result;
        }
    }

    // Perplexity API search
    const apiKey = resolveApiKey(config);
    if (!apiKey) {
        // Fall back to browser if API key is missing
        const maxResults = config?.maxResults ?? 5;
        const headless = config?.headless !== false;
        const browserResult = await runBrowserSearch({
            query,
            maxResults,
            headless,
        });

        const result: WebSearchResult = {
            query,
            provider: "browser",
            tookMs: browserResult.tookMs,
            content: browserResult.content,
            citations: browserResult.citations,
            searchResults: browserResult.searchResults,
            scrapedPages: browserResult.scrapedPages,
        };

        writeCache(SEARCH_CACHE, normalizeCacheKey(`browser:${query}`), result, cacheTtlMs);
        return result;
    }

    const baseUrl = config?.baseUrl ?? DEFAULT_PERPLEXITY_BASE_URL;
    const model = config?.model ?? DEFAULT_PERPLEXITY_MODEL;
    const timeoutSeconds = resolveTimeoutSeconds(config?.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS);

    try {
        const start = Date.now();
        const { content, citations } = await runPerplexitySearch({
            query,
            apiKey,
            baseUrl,
            model,
            timeoutSeconds,
        });

        const result: WebSearchResult = {
            query,
            provider: "perplexity",
            model,
            tookMs: Date.now() - start,
            content,
            citations,
        };

        writeCache(SEARCH_CACHE, cacheKey, result, cacheTtlMs);
        return result;
    } catch (err) {
        const maxResults = config?.maxResults ?? 5;
        const headless = config?.headless !== false;
        const browserResult = await runBrowserSearch({
            query,
            maxResults,
            headless,
        });

        const result: WebSearchResult = {
            query,
            provider: "browser",
            tookMs: browserResult.tookMs,
            content: browserResult.content,
            citations: browserResult.citations,
            searchResults: browserResult.searchResults,
            scrapedPages: browserResult.scrapedPages,
        };

        writeCache(SEARCH_CACHE, normalizeCacheKey(`browser:${query}`), result, cacheTtlMs);
        return result;
    }
}

/**
 * Search with structured market-focused query.
 */
export async function searchMarketInfo(
    asset: string,
    topic: string,
    config?: WebSearchConfig,
): Promise<WebSearchResult> {
    const query = `${asset} ${topic} latest news and analysis`;
    return webSearch(query, config);
}

/**
 * Multi-query search for comprehensive analysis.
 */
export async function searchMultiple(
    queries: string[],
    config?: WebSearchConfig,
): Promise<WebSearchResult[]> {
    const results: WebSearchResult[] = [];
    for (const query of queries.slice(0, MAX_SEARCH_COUNT)) {
        try {
            const result = await webSearch(query, config);
            results.push(result);
        } catch (error) {
            console.warn(`Search failed for query "${query}":`, error);
        }
    }
    return results;
}
