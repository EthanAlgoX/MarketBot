// Reflection Agent - synthesizes analysis and identifies blindspots

import type { LLMProvider, LLMMessage } from "../core/llm.js";
import type { ReflectionInput, ReflectionOutput } from "../core/types.js";

const REFLECTION_PROMPT = `You are a reflection analyst who reviews market analysis.
Based on the intent, market interpretation, regime, and risk assessment:
- confidence_score: Number from 0 to 1
- potential_blindspots: Array of things the analysis might have missed
- alternative_scenarios: Array of alternative market scenarios
- recommendation_strength: One of "strong", "moderate", "weak"
- final_summary: Concise final assessment

Respond with valid JSON only.`;

/**
 * Reflect on the analysis to identify potential issues and alternatives.
 */
export async function runReflection(
    provider: LLMProvider,
    input: ReflectionInput,
    systemPrompt?: string
): Promise<ReflectionOutput> {
    const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt ?? REFLECTION_PROMPT },
        { role: "user", content: `Reflect on this analysis: ${JSON.stringify(input)}` },
    ];

    const response = await provider.chat(messages);

    try {
        const parsed = JSON.parse(response.content) as ReflectionOutput;
        return validateReflection(parsed);
    } catch {
        return reflectFallback(input);
    }
}

function validateReflection(parsed: Partial<ReflectionOutput>): ReflectionOutput {
    return {
        confidence_score: Math.min(1, Math.max(0, parsed.confidence_score ?? 0.5)),
        potential_blindspots: parsed.potential_blindspots ?? [],
        alternative_scenarios: parsed.alternative_scenarios ?? [],
        recommendation_strength: parsed.recommendation_strength ?? "moderate",
        final_summary: parsed.final_summary ?? "Analysis review complete.",
    };
}

function reflectFallback(input: ReflectionInput): ReflectionOutput {
    const { intent, market, regime, risk } = input;

    // Calculate confidence based on consistency
    let confidenceScore = 0.5;
    const blindspots: string[] = [];
    const alternatives: string[] = [];

    // Check for consistency
    if (regime.regime === "bull_trend" && market.momentum.includes("bullish")) {
        confidenceScore += 0.15;
    } else if (regime.regime === "bear_trend" && market.momentum.includes("bearish")) {
        confidenceScore += 0.15;
    } else {
        confidenceScore -= 0.1;
        blindspots.push("Mixed signals between regime and momentum");
    }

    // Regime confidence affects overall confidence
    confidenceScore += (regime.confidence - 0.5) * 0.3;

    // Risk-based adjustments
    if (risk.risk_level === "extreme") {
        confidenceScore -= 0.15;
        blindspots.push("Extreme risk conditions may invalidate analysis");
    } else if (risk.risk_level === "low") {
        confidenceScore += 0.1;
    }

    // Common blindspots
    if (market.volatility_state === "high") {
        blindspots.push("High volatility may cause rapid sentiment shifts");
    }
    if (intent.timeframes.length < 2) {
        blindspots.push("Limited timeframe analysis");
    }
    blindspots.push("External macro events not considered");
    blindspots.push("Large player (whale) activity unknown");

    // Alternative scenarios
    if (market.market_structure === "ranging") {
        alternatives.push("Breakout above resistance");
        alternatives.push("Breakdown below support");
    } else if (market.market_structure === "trending_up") {
        alternatives.push("Trend exhaustion and reversal");
        alternatives.push("Accelerated continuation");
    } else if (market.market_structure === "trending_down") {
        alternatives.push("Capitulation and bounce");
        alternatives.push("Extended decline");
    }

    // Determine recommendation strength
    let strength: ReflectionOutput["recommendation_strength"] = "moderate";
    if (confidenceScore >= 0.7) strength = "strong";
    else if (confidenceScore <= 0.4) strength = "weak";

    // Clamp confidence
    confidenceScore = Math.min(1, Math.max(0, confidenceScore));

    const summary = `Analysis of ${intent.asset} shows ${market.market_structure} conditions. ${regime.recommended_strategy === "wait" ? "Recommend caution." : `Consider ${regime.recommended_strategy} approach.`} Confidence: ${Math.round(confidenceScore * 100)}%.`;

    return {
        confidence_score: Math.round(confidenceScore * 100) / 100,
        potential_blindspots: blindspots.slice(0, 4),
        alternative_scenarios: alternatives.slice(0, 3),
        recommendation_strength: strength,
        final_summary: summary,
    };
}
