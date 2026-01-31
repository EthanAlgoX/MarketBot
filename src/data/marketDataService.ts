// Market data service - fetches data from various sources

import type { IntentParsingOutput, MarketDataInput } from "../core/types.js";
import { mockMarketData } from "./mockMarketData.js";

export interface MarketDataServiceOptions {
    mode?: "mock" | "auto" | "api" | "scrape";
    enableSearch?: boolean;
    apiKey?: string;
}

/**
 * Fetch market data based on the parsed intent.
 * Supports multiple data sources: mock, API, and scraping.
 */
export async function getMarketDataFromIntent(
    intent: IntentParsingOutput,
    options?: MarketDataServiceOptions
): Promise<MarketDataInput> {
    const mode = options?.mode ?? "mock";

    switch (mode) {
        case "mock":
            return mockMarketData(intent.asset);

        case "api":
            return fetchFromApi(intent, options);

        case "scrape":
            return fetchFromScraper(intent, options);

        case "auto":
        default:
            // Try API first, fall back to mock
            try {
                return await fetchFromApi(intent, options);
            } catch {
                console.warn("API fetch failed, falling back to mock data");
                return mockMarketData(intent.asset);
            }
    }
}

/**
 * Fetch data from a market data API.
 * Currently returns mock data - implement real API integration as needed.
 */
async function fetchFromApi(
    intent: IntentParsingOutput,
    _options?: MarketDataServiceOptions
): Promise<MarketDataInput> {
    // TODO: Implement real API integration (e.g., Binance, CoinGecko, Alpha Vantage)
    // For now, return mock data with a simulated delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    return mockMarketData(intent.asset);
}

/**
 * Fetch data by scraping web sources.
 * Currently returns mock data - implement real scraping as needed.
 */
async function fetchFromScraper(
    intent: IntentParsingOutput,
    _options?: MarketDataServiceOptions
): Promise<MarketDataInput> {
    // TODO: Implement web scraping for market data
    await new Promise((resolve) => setTimeout(resolve, 100));
    return mockMarketData(intent.asset);
}
