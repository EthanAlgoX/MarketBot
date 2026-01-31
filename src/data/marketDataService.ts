// Market data service - fetches data from various sources

import type { IntentParsingOutput, MarketDataInput } from "../core/types.js";
import { resolveSymbolFromText } from "../utils/symbols.js";
import type { QuoteSnapshot } from "./types.js";
import { fetchQuoteSnapshot } from "./quotes.js";
import { searchMarketInfo } from "../web/webSearch.js";

export interface MarketDataServiceOptions {
    mode?: "auto" | "api" | "scrape";
    enableSearch?: boolean;
    apiKey?: string;
}

/**
 * Fetch market data based on the parsed intent.
 * Supports API and scraping modes (auto defaults to API).
 */
export async function getMarketDataFromIntent(
    intent: IntentParsingOutput,
    options?: MarketDataServiceOptions
): Promise<MarketDataInput> {
    const mode = options?.mode ?? "auto";

    switch (mode) {
        case "api":
            return fetchFromApi(intent, options);

        case "scrape":
            return fetchFromScraper(intent, options);

        case "auto":
        default:
            try {
                return await fetchFromApi(intent, options);
            } catch (apiErr) {
                try {
                    return await fetchFromScraper(intent, options);
                } catch (scrapeErr) {
                    const apiMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
                    const scrapeMsg = scrapeErr instanceof Error ? scrapeErr.message : String(scrapeErr);
                    throw new Error(`Auto mode failed. API: ${apiMsg} | Scrape: ${scrapeMsg}`);
                }
            }
    }
}

/**
 * Fetch data from a market data API.
 * Currently uses quote snapshots to align prices with live markets.
 */
async function fetchFromApi(
    intent: IntentParsingOutput,
    options?: MarketDataServiceOptions
): Promise<MarketDataInput> {
    const resolvedAsset = resolveSymbolFromText(intent.asset) ?? intent.asset;
    const snapshot = await fetchQuoteSnapshot(resolvedAsset);
    if (!snapshot) {
        // Fallback if quote unavailable (e.g. rate limit 429 or disabled)
        // Return empty structure to allow pipeline to proceed (e.g. for news/sentiment analysis)
        return {
            price_structure: {
                trend_1h: "range",
                trend_4h: "range",
                support_levels: [],
                resistance_levels: [],
            },
            indicators: {
                ema_alignment: "neutral",
                atr_change: "stable",
                volume_state: "stable",
            },
            timestamp: new Date().toISOString(),
        };
    }

    const baseData = buildBaselineMarketData(snapshot.price);
    const result = applySnapshotToMarketData(baseData, snapshot);

    if (options?.enableSearch) {
        try {
            const news = await searchMarketInfo(resolvedAsset, "latest news and market sentiment");
            if (news.content) {
                result.news_context = [news.content];
            }
        } catch (e) {
            console.warn(`News fetch failed for ${resolvedAsset}:`, e);
        }
    }

    return result;
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
        source: snapshot.source,
        exchange: snapshot.exchange,
        currency: snapshot.currency,
        market_state: snapshot.marketState,
        price_type: snapshot.priceType,
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

function buildBaselineMarketData(price: number): MarketDataInput {
    const support1 = round(price * 0.97);
    const support2 = round(price * 0.94);
    const resistance1 = round(price * 1.03);
    const resistance2 = round(price * 1.06);

    return {
        price_structure: {
            trend_1h: "range",
            trend_4h: "range",
            trend_1d: "range",
            support_levels: [support1, support2],
            resistance_levels: [resistance1, resistance2],
        },
        indicators: {
            ema_alignment: "neutral",
            rsi_1h: 50,
            rsi_4h: 50,
            macd_signal: "neutral",
            atr_change: "stable",
            volume_state: "stable",
            bollinger_position: "middle",
        },
        current_price: price,
        timestamp: new Date().toISOString(),
    };
}
