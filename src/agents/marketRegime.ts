// Market Regime Agent - identifies current market regime

import type { LLMProvider, LLMMessage } from "../core/llm.js";
import type { MarketRegimeInput, MarketRegimeOutput } from "../core/types.js";
import { tryParseJson } from "./jsonUtils.js";

const REGIME_PROMPT = `You are a market regime analyst.
Based on the market structure, volatility, and higher timeframe bias, determine:
- regime: One of "bull_trend", "bear_trend", "accumulation", "distribution", "choppy"
- confidence: Number from 0 to 1
- recommended_strategy: One of "trend_following", "mean_reversion", "wait", "hedge"
- rationale: Brief explanation

Respond with valid JSON only.`;

/**
 * Identify the current market regime.
 */
export async function runMarketRegime(
    provider: LLMProvider,
    input: MarketRegimeInput,
    systemPrompt?: string
): Promise<MarketRegimeOutput> {
    const combinedPrompt = systemPrompt ? `${systemPrompt}\n\n${REGIME_PROMPT}` : REGIME_PROMPT;
    const messages: LLMMessage[] = [
        { role: "system", content: combinedPrompt },
        { role: "user", content: `Analyze regime: ${JSON.stringify(input)}` },
    ];

    const response = await provider.chat(messages);

    const parsed = tryParseJson<Partial<MarketRegimeOutput>>(response.content);
    if (parsed) return validateRegime(parsed);
    return analyzeRegimeFallback(input);
}

function validateRegime(parsed: Partial<MarketRegimeOutput>): MarketRegimeOutput {
    return {
        regime: parsed.regime ?? "choppy",
        confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
        recommended_strategy: parsed.recommended_strategy ?? "wait",
        rationale: parsed.rationale ?? "Regime analysis complete.",
    };
}

function analyzeRegimeFallback(input: MarketRegimeInput): MarketRegimeOutput {
    const { market_structure, volatility_state, higher_tf_bias } = input;

    let regime: MarketRegimeOutput["regime"] = "choppy";
    let strategy: MarketRegimeOutput["recommended_strategy"] = "wait";
    let confidence = 0.5;

    // Trending conditions
    if (market_structure === "trending_up" && higher_tf_bias === "bullish") {
        regime = "bull_trend";
        strategy = "trend_following";
        confidence = 0.75;
    } else if (market_structure === "trending_down" && higher_tf_bias === "bearish") {
        regime = "bear_trend";
        strategy = "trend_following";
        confidence = 0.75;
    }
    // Ranging conditions
    else if (market_structure === "ranging") {
        if (higher_tf_bias === "bullish" && volatility_state === "low") {
            regime = "accumulation";
            strategy = "mean_reversion";
            confidence = 0.6;
        } else if (higher_tf_bias === "bearish" && volatility_state === "low") {
            regime = "distribution";
            strategy = "hedge";
            confidence = 0.6;
        } else {
            regime = "choppy";
            strategy = "wait";
            confidence = 0.5;
        }
    }
    // Volatile conditions
    else if (market_structure === "volatile") {
        regime = "choppy";
        strategy = volatility_state === "high" ? "wait" : "mean_reversion";
        confidence = 0.4;
    }

    const rationale = `Market structure is ${market_structure} with ${volatility_state} volatility. Higher TF bias: ${higher_tf_bias}.`;

    return { regime, confidence, recommended_strategy: strategy, rationale };
}
