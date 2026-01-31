// Market data service - fetches data from various sources

import type { IntentParsingOutput, MarketDataInput } from "../core/types.js";
import { resolveSymbolFromText } from "../utils/symbols.js";
import type { QuoteSnapshot } from "./types.js";
import { fetchQuoteSnapshot } from "./quotes.js";
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
    const mode = options?.mode ?? "auto";

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
 * Currently uses quote snapshots to align prices with live markets.
 */
async function fetchFromApi(
    intent: IntentParsingOutput,
    _options?: MarketDataServiceOptions
): Promise<MarketDataInput> {
    const resolvedAsset = resolveSymbolFromText(intent.asset) ?? intent.asset;
    const baseData = mockMarketData(resolvedAsset);

    const snapshot = await fetchQuoteSnapshot(resolvedAsset);
    if (!snapshot) return baseData;

    return applySnapshotToMarketData(baseData, snapshot);
}

/**
 * Fetch data by scraping web sources.
 * Currently uses quote snapshots as a safe fallback.
 */
async function fetchFromScraper(
    intent: IntentParsingOutput,
    options?: MarketDataServiceOptions
): Promise<MarketDataInput> {
    return fetchFromApi(intent, options);
}

function applySnapshotToMarketData(data: MarketDataInput, snapshot: QuoteSnapshot): MarketDataInput {
    const baseline = data.current_price ?? snapshot.price;
    const scale = baseline ? snapshot.price / baseline : 1;
    const scaleLevels = (levels?: number[]) => levels?.map((level) => round(level * scale));

    return {
        ...data,
        current_price: snapshot.price,
        timestamp: snapshot.timestamp ?? data.timestamp,
        price_structure: {
            ...data.price_structure,
            support_levels: scaleLevels(data.price_structure.support_levels),
            resistance_levels: scaleLevels(data.price_structure.resistance_levels),
        },
    };
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}
