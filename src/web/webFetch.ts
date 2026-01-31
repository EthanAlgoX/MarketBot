// Web Fetch Service - URL content fetching and extraction

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
    extractReadableContent,
    htmlToMarkdown,
    markdownToText,
    truncateText,
    type ExtractMode,
} from "./fetchUtils.js";

const DEFAULT_FETCH_MAX_CHARS = 50_000;
const DEFAULT_FETCH_MAX_REDIRECTS = 3;
const DEFAULT_USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const FETCH_CACHE = new Map<string, CacheEntry<WebFetchResult>>();

export interface WebFetchConfig {
    enabled?: boolean;
    maxChars?: number;
    maxRedirects?: number;
    timeoutSeconds?: number;
    cacheTtlMinutes?: number;
    userAgent?: string;
}

export interface WebFetchResult {
    url: string;
    finalUrl: string;
    status: number;
    contentType?: string;
    title?: string;
    extractMode: ExtractMode;
    extractor: string;
    truncated: boolean;
    length: number;
    fetchedAt: string;
    tookMs: number;
    text: string;
    cached?: boolean;
}

function isRedirectStatus(status: number): boolean {
    return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function fetchWithRedirects(params: {
    url: string;
    maxRedirects: number;
    timeoutSeconds: number;
    userAgent: string;
}): Promise<{ response: Response; finalUrl: string }> {
    const signal = withTimeout(undefined, params.timeoutSeconds * 1000);
    const visited = new Set<string>();
    let currentUrl = params.url;
    let redirectCount = 0;

    while (true) {
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(currentUrl);
        } catch {
            throw new Error("Invalid URL: must be http or https");
        }
        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            throw new Error("Invalid URL: must be http or https");
        }

        const res = await fetch(parsedUrl.toString(), {
            method: "GET",
            headers: {
                Accept: "*/*",
                "User-Agent": params.userAgent,
                "Accept-Language": "en-US,en;q=0.9",
            },
            signal,
            redirect: "manual",
        });

        if (isRedirectStatus(res.status)) {
            const location = res.headers.get("location");
            if (!location) {
                throw new Error(`Redirect missing location header (${res.status})`);
            }
            redirectCount += 1;
            if (redirectCount > params.maxRedirects) {
                throw new Error(`Too many redirects (limit: ${params.maxRedirects})`);
            }
            const nextUrl = new URL(location, parsedUrl).toString();
            if (visited.has(nextUrl)) {
                throw new Error("Redirect loop detected");
            }
            visited.add(nextUrl);
            void res.body?.cancel();
            currentUrl = nextUrl;
            continue;
        }

        return { response: res, finalUrl: currentUrl };
    }
}

export async function webFetch(
    url: string,
    options?: { extractMode?: ExtractMode; config?: WebFetchConfig },
): Promise<WebFetchResult> {
    const config = options?.config;
    const extractMode = options?.extractMode ?? "markdown";
    const maxChars = config?.maxChars ?? DEFAULT_FETCH_MAX_CHARS;
    const maxRedirects = config?.maxRedirects ?? DEFAULT_FETCH_MAX_REDIRECTS;
    const timeoutSeconds = resolveTimeoutSeconds(config?.timeoutSeconds, DEFAULT_TIMEOUT_SECONDS);
    const cacheTtlMs = resolveCacheTtlMs(config?.cacheTtlMinutes, DEFAULT_CACHE_TTL_MINUTES);
    const userAgent = config?.userAgent ?? DEFAULT_USER_AGENT;

    const cacheKey = normalizeCacheKey(`fetch:${url}:${extractMode}:${maxChars}`);
    const cached = readCache(FETCH_CACHE, cacheKey);
    if (cached) return { ...cached.value, cached: true };

    const start = Date.now();
    const { response: res, finalUrl } = await fetchWithRedirects({
        url,
        maxRedirects,
        timeoutSeconds,
        userAgent,
    });

    if (!res.ok) {
        const detail = await readResponseText(res);
        throw new Error(`Web fetch failed (${res.status}): ${detail || res.statusText}`);
    }

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const body = await readResponseText(res);

    let title: string | undefined;
    let extractor = "raw";
    let text = body;

    if (contentType.includes("text/html")) {
        const readable = await extractReadableContent({
            html: body,
            url: finalUrl,
            extractMode,
        });
        if (readable?.text) {
            text = readable.text;
            title = readable.title;
            extractor = "readability";
        } else {
            const rendered = htmlToMarkdown(body);
            text = extractMode === "text" ? markdownToText(rendered.text) : rendered.text;
            title = rendered.title;
            extractor = "fallback";
        }
    } else if (contentType.includes("application/json")) {
        try {
            text = JSON.stringify(JSON.parse(body), null, 2);
            extractor = "json";
        } catch {
            text = body;
            extractor = "raw";
        }
    }

    const truncated = truncateText(text, maxChars);
    const result: WebFetchResult = {
        url,
        finalUrl,
        status: res.status,
        contentType,
        title,
        extractMode,
        extractor,
        truncated: truncated.truncated,
        length: truncated.text.length,
        fetchedAt: new Date().toISOString(),
        tookMs: Date.now() - start,
        text: truncated.text,
    };

    writeCache(FETCH_CACHE, cacheKey, result, cacheTtlMs);
    return result;
}

/**
 * Fetch multiple URLs in parallel.
 */
export async function webFetchMultiple(
    urls: string[],
    options?: { extractMode?: ExtractMode; config?: WebFetchConfig },
): Promise<WebFetchResult[]> {
    const results: WebFetchResult[] = [];
    for (const url of urls.slice(0, 10)) {
        try {
            const result = await webFetch(url, options);
            results.push(result);
        } catch (error) {
            console.warn(`Fetch failed for URL "${url}":`, error);
        }
    }
    return results;
}
