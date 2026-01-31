// Market Data Interpreter Agent - analyzes raw market data

import type { LLMProvider, LLMMessage } from "../core/llm.js";
import type { MarketDataInput, MarketDataInterpretation } from "../core/types.js";

const INTERPRETER_PROMPT = `You are a market data interpreter.
Analyze the provided market data and produce:
- market_structure: One of "trending_up", "trending_down", "ranging", "volatile"
- volatility_state: One of "high", "medium", "low"
- momentum: One of "strong_bullish", "bullish", "neutral", "bearish", "strong_bearish"
- key_levels: Object with nearest_support and nearest_resistance
- summary: Brief text summary

Respond with valid JSON only.`;

/**
 * Interpret market data and identify patterns.
 */
export async function runMarketDataInterpreter(
    provider: LLMProvider,
    marketData: MarketDataInput,
    systemPrompt?: string
): Promise<MarketDataInterpretation> {
    const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt ?? INTERPRETER_PROMPT },
        { role: "user", content: `Interpret this market data: ${JSON.stringify(marketData)}` },
    ];

    const response = await provider.chat(messages);

    try {
        const parsed = JSON.parse(response.content) as MarketDataInterpretation;
        return validateInterpretation(parsed);
    } catch {
        // Fallback to rule-based interpretation
        return interpretFallback(marketData);
    }
}

function validateInterpretation(parsed: Partial<MarketDataInterpretation>): MarketDataInterpretation {
    return {
        market_structure: parsed.market_structure ?? "ranging",
        volatility_state: parsed.volatility_state ?? "medium",
        momentum: parsed.momentum ?? "neutral",
        key_levels: parsed.key_levels ?? {},
        summary: parsed.summary ?? "Market conditions analyzed.",
    };
}

function interpretFallback(data: MarketDataInput): MarketDataInterpretation {
    const { price_structure, indicators } = data;

    // Determine market structure
    let marketStructure: MarketDataInterpretation["market_structure"] = "ranging";
    if (price_structure.trend_1h === "up" && price_structure.trend_4h === "up") {
        marketStructure = "trending_up";
    } else if (price_structure.trend_1h === "down" && price_structure.trend_4h === "down") {
        marketStructure = "trending_down";
    } else if (indicators.atr_change === "increasing") {
        marketStructure = "volatile";
    }

    // Determine volatility
    let volatilityState: MarketDataInterpretation["volatility_state"] = "medium";
    if (indicators.atr_change === "increasing" && indicators.volume_state === "expanding") {
        volatilityState = "high";
    } else if (indicators.atr_change === "decreasing" && indicators.volume_state === "contracting") {
        volatilityState = "low";
    }

    // Determine momentum
    let momentum: MarketDataInterpretation["momentum"] = "neutral";
    const rsi = indicators.rsi_1h ?? 50;
    if (rsi >= 70) momentum = "strong_bullish";
    else if (rsi >= 55) momentum = "bullish";
    else if (rsi <= 30) momentum = "strong_bearish";
    else if (rsi <= 45) momentum = "bearish";

    // Key levels
    const keyLevels = {
        nearest_support: price_structure.support_levels?.[0],
        nearest_resistance: price_structure.resistance_levels?.[0],
    };

    // Generate summary
    const summaryParts = [
        `Market is ${marketStructure.replace("_", " ")}.`,
        `Volatility: ${volatilityState}.`,
        `Momentum: ${momentum.replace("_", " ")}.`,
    ];

    return {
        market_structure: marketStructure,
        volatility_state: volatilityState,
        momentum,
        key_levels: keyLevels,
        summary: summaryParts.join(" "),
    };
}
