// Risk Assessment Agent - evaluates trading risk

import type { LLMProvider, LLMMessage } from "../core/llm.js";
import type { RiskAssessmentInput, RiskAssessmentOutput } from "../core/types.js";

const RISK_PROMPT = `You are a risk assessment analyst.
Based on the market regime, volatility, and asset, determine:
- risk_level: One of "low", "medium", "high", "extreme"
- position_size_recommendation: One of "full", "half", "quarter", "none"
- stop_loss_suggestion: One of "tight", "normal", "wide"
- max_drawdown_warning: Optional warning message
- rationale: Brief explanation

Respond with valid JSON only.`;

/**
 * Assess trading risk based on market conditions.
 */
export async function runRiskAssessment(
    provider: LLMProvider,
    input: RiskAssessmentInput,
    systemPrompt?: string
): Promise<RiskAssessmentOutput> {
    const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt ?? RISK_PROMPT },
        { role: "user", content: `Assess risk: ${JSON.stringify(input)}` },
    ];

    const response = await provider.chat(messages);

    try {
        const parsed = JSON.parse(response.content) as RiskAssessmentOutput;
        return validateRisk(parsed);
    } catch {
        return assessRiskFallback(input);
    }
}

function validateRisk(parsed: Partial<RiskAssessmentOutput>): RiskAssessmentOutput {
    return {
        risk_level: parsed.risk_level ?? "medium",
        position_size_recommendation: parsed.position_size_recommendation ?? "half",
        stop_loss_suggestion: parsed.stop_loss_suggestion ?? "normal",
        max_drawdown_warning: parsed.max_drawdown_warning,
        rationale: parsed.rationale ?? "Risk assessment complete.",
    };
}

function assessRiskFallback(input: RiskAssessmentInput): RiskAssessmentOutput {
    const { regime, volatility_state, asset } = input;

    let riskLevel: RiskAssessmentOutput["risk_level"] = "medium";
    let positionSize: RiskAssessmentOutput["position_size_recommendation"] = "half";
    let stopLoss: RiskAssessmentOutput["stop_loss_suggestion"] = "normal";
    let warning: string | undefined;

    // Regime-based risk assessment
    if (regime === "bull_trend" || regime === "bear_trend") {
        riskLevel = volatility_state === "high" ? "medium" : "low";
        positionSize = volatility_state === "high" ? "half" : "full";
        stopLoss = volatility_state === "high" ? "wide" : "normal";
    } else if (regime === "choppy") {
        riskLevel = volatility_state === "high" ? "extreme" : "high";
        positionSize = volatility_state === "high" ? "none" : "quarter";
        stopLoss = "tight";
        warning = "Choppy market conditions - consider reducing exposure.";
    } else if (regime === "accumulation") {
        riskLevel = "low";
        positionSize = "half";
        stopLoss = "normal";
    } else if (regime === "distribution") {
        riskLevel = "high";
        positionSize = "quarter";
        stopLoss = "tight";
        warning = "Distribution phase detected - watch for breakdowns.";
    }

    // High volatility adjustments
    if (volatility_state === "high") {
        stopLoss = "wide";
        if (positionSize === "full") positionSize = "half";
        if (!warning) warning = "High volatility - use wider stops.";
    }

    const rationale = `${asset} in ${regime} regime with ${volatility_state} volatility. Recommended position: ${positionSize}.`;

    return {
        risk_level: riskLevel,
        position_size_recommendation: positionSize,
        stop_loss_suggestion: stopLoss,
        max_drawdown_warning: warning,
        rationale,
    };
}
