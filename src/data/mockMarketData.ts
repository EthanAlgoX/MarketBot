// Mock market data generator for testing

import type { MarketDataInput } from "../core/types.js";

/**
 * Generate mock market data for testing purposes.
 */
export function mockMarketData(asset: string = "BTC"): MarketDataInput {
    const basePrice = asset === "BTC" ? 42000 : asset === "ETH" ? 2500 : 100;

    return {
        price_structure: {
            trend_1h: "range",
            trend_4h: "up",
            trend_1d: "up",
            support_levels: [basePrice * 0.95, basePrice * 0.9],
            resistance_levels: [basePrice * 1.05, basePrice * 1.1],
        },
        indicators: {
            ema_alignment: "bullish",
            rsi_1h: 55,
            rsi_4h: 58,
            macd_signal: "neutral",
            atr_change: "stable",
            volume_state: "stable",
            bollinger_position: "middle",
        },
        current_price: basePrice,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Generate bullish mock data.
 */
export function mockBullishData(asset: string = "BTC"): MarketDataInput {
    const basePrice = asset === "BTC" ? 45000 : asset === "ETH" ? 2800 : 120;

    return {
        price_structure: {
            trend_1h: "up",
            trend_4h: "up",
            trend_1d: "up",
            support_levels: [basePrice * 0.95, basePrice * 0.9],
            resistance_levels: [basePrice * 1.1, basePrice * 1.2],
        },
        indicators: {
            ema_alignment: "bullish",
            rsi_1h: 65,
            rsi_4h: 62,
            macd_signal: "bullish",
            atr_change: "increasing",
            volume_state: "expanding",
            bollinger_position: "upper",
        },
        current_price: basePrice,
        timestamp: new Date().toISOString(),
    };
}

/**
 * Generate bearish mock data.
 */
export function mockBearishData(asset: string = "BTC"): MarketDataInput {
    const basePrice = asset === "BTC" ? 38000 : asset === "ETH" ? 2200 : 80;

    return {
        price_structure: {
            trend_1h: "down",
            trend_4h: "down",
            trend_1d: "range",
            support_levels: [basePrice * 0.9, basePrice * 0.85],
            resistance_levels: [basePrice * 1.05, basePrice * 1.1],
        },
        indicators: {
            ema_alignment: "bearish",
            rsi_1h: 35,
            rsi_4h: 38,
            macd_signal: "bearish",
            atr_change: "increasing",
            volume_state: "expanding",
            bollinger_position: "lower",
        },
        current_price: basePrice,
        timestamp: new Date().toISOString(),
    };
}
