// Browser Scraper - Puppeteer-based web scraping

// Note: Using dynamic import for puppeteer to handle optional dependency
// This module implements actual browser automation for web scraping

export interface BrowserSearchResult {
    title: string;
    url: string;
    snippet: string;
}

export interface BrowserConfig {
    headless?: boolean;
    userAgent?: string;
    timeout?: number;
}

export interface ScrapedPage {
    url: string;
    title: string;
    content: string;
    scrapedAt: string;
}

const DEFAULT_USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT = 30000;

type PuppeteerBrowser = Awaited<ReturnType<typeof import("puppeteer").launch>>;
type PuppeteerPage = Awaited<ReturnType<PuppeteerBrowser["newPage"]>>;

let browserInstance: PuppeteerBrowser | null = null;

async function getPuppeteer() {
    try {
        return await import("puppeteer");
    } catch {
        throw new Error(
            "Puppeteer is not installed. Run: npm install puppeteer",
        );
    }
}

/**
 * Launch browser instance (reuses existing if available)
 */
export async function launchBrowser(config?: BrowserConfig): Promise<void> {
    if (browserInstance) return;

    const puppeteer = await getPuppeteer();
    browserInstance = await puppeteer.launch({
        headless: config?.headless !== false ? true : false,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu",
        ],
    });
}

/**
 * Close browser instance
 */
export async function closeBrowser(): Promise<void> {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}

/**
 * Create a new page with default settings
 */
async function createPage(config?: BrowserConfig): Promise<PuppeteerPage> {
    if (!browserInstance) {
        await launchBrowser(config);
    }
    const page = await browserInstance!.newPage();
    await page.setUserAgent(config?.userAgent ?? DEFAULT_USER_AGENT);
    await page.setViewport({ width: 1280, height: 800 });
    page.setDefaultTimeout(config?.timeout ?? DEFAULT_TIMEOUT);
    return page;
}

/**
 * Search on Bing (more scraping-friendly than Google)
 */
export async function searchBing(
    query: string,
    maxResults = 5,
    config?: BrowserConfig,
): Promise<BrowserSearchResult[]> {
    const page = await createPage(config);
    const results: BrowserSearchResult[] = [];

    try {
        // Navigate to Bing
        await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
            waitUntil: "domcontentloaded",
        });

        // Wait for results
        await page.waitForSelector("#b_results", { timeout: 10000 });

        // Extract search results
        const items = await page.evaluate(() => {
            const results: Array<{ title: string; url: string; snippet: string }> = [];
            const elements = document.querySelectorAll("#b_results .b_algo");

            elements.forEach((el) => {
                const linkEl = el.querySelector("h2 a");
                const snippetEl = el.querySelector(".b_caption p");

                if (linkEl) {
                    results.push({
                        title: linkEl.textContent?.trim() || "",
                        url: linkEl.getAttribute("href") || "",
                        snippet: snippetEl?.textContent?.trim() || "",
                    });
                }
            });

            return results;
        });

        results.push(...items.slice(0, maxResults));
    } catch (error) {
        console.warn("Bing search failed:", error);
    } finally {
        await page.close();
    }

    return results;
}

/**
 * Search on DuckDuckGo (privacy-friendly, less blocking)
 */
export async function searchDuckDuckGo(
    query: string,
    maxResults = 5,
    config?: BrowserConfig,
): Promise<BrowserSearchResult[]> {
    const page = await createPage(config);
    const results: BrowserSearchResult[] = [];

    try {
        // Navigate to DuckDuckGo
        await page.goto(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
            waitUntil: "domcontentloaded",
        });

        // Extract search results
        const items = await page.evaluate(() => {
            const results: Array<{ title: string; url: string; snippet: string }> = [];
            const elements = document.querySelectorAll(".result");

            elements.forEach((el) => {
                const linkEl = el.querySelector(".result__a");
                const snippetEl = el.querySelector(".result__snippet");

                if (linkEl) {
                    let url = linkEl.getAttribute("href") || "";

                    // DuckDuckGo uses redirect URLs, extract actual URL from uddg parameter
                    if (url.includes("duckduckgo.com/l/") && url.includes("uddg=")) {
                        try {
                            const params = new URLSearchParams(url.split("?")[1] || "");
                            const actualUrl = params.get("uddg");
                            if (actualUrl) {
                                url = decodeURIComponent(actualUrl);
                            }
                        } catch {
                            // Keep original URL if decoding fails
                        }
                    }

                    results.push({
                        title: linkEl.textContent?.trim() || "",
                        url,
                        snippet: snippetEl?.textContent?.trim() || "",
                    });
                }
            });

            return results;
        });

        results.push(...items.slice(0, maxResults));
    } catch (error) {
        console.warn("DuckDuckGo search failed:", error);
    } finally {
        await page.close();
    }

    return results;
}

/**
 * Scrape page content from URL
 */
export async function scrapePageContent(
    url: string,
    config?: BrowserConfig,
): Promise<ScrapedPage | null> {
    const page = await createPage(config);

    try {
        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: config?.timeout ?? DEFAULT_TIMEOUT,
        });

        // Extract page content
        const data = await page.evaluate(() => {
            const title = document.title || "";

            // Remove script and style elements
            const clone = document.body.cloneNode(true) as HTMLElement;
            clone.querySelectorAll("script, style, noscript, nav, footer, header, aside").forEach((el) => el.remove());

            // Get text content
            const content = clone.textContent || "";

            return {
                title,
                content: content.replace(/\s+/g, " ").trim().slice(0, 30000),
            };
        });

        return {
            url,
            title: data.title,
            content: data.content,
            scrapedAt: new Date().toISOString(),
        };
    } catch (error) {
        console.warn(`Failed to scrape ${url}:`, error);
        return null;
    } finally {
        await page.close();
    }
}

/**
 * Full browser-based search and scrape workflow
 */
export async function browserSearchAndScrape(
    query: string,
    options?: {
        maxSearchResults?: number;
        maxPagesToScrape?: number;
        config?: BrowserConfig;
    },
): Promise<{
    searchResults: BrowserSearchResult[];
    scrapedPages: ScrapedPage[];
    tookMs: number;
}> {
    const start = Date.now();
    const maxSearchResults = options?.maxSearchResults ?? 5;
    const maxPagesToScrape = options?.maxPagesToScrape ?? 3;

    try {
        await launchBrowser(options?.config);

        // Search using DuckDuckGo (more reliable for scraping)
        const searchResults = await searchDuckDuckGo(query, maxSearchResults, options?.config);

        // Scrape top results
        const scrapedPages: ScrapedPage[] = [];
        for (const result of searchResults.slice(0, maxPagesToScrape)) {
            if (!result.url.startsWith("http")) continue;
            const page = await scrapePageContent(result.url, options?.config);
            if (page) scrapedPages.push(page);
        }

        return {
            searchResults,
            scrapedPages,
            tookMs: Date.now() - start,
        };
    } finally {
        await closeBrowser();
    }
}
