// Report Generator Agent - produces human-readable analysis reports

import type { LLMProvider, LLMMessage } from "../core/llm.js";
import type { ReportContext } from "../core/types.js";

const REPORT_PROMPT = `You are a market analyst report writer.
Based on the complete analysis context, generate a professional, concise market report.
Include: Executive Summary, Market Conditions, Risk Assessment, and Recommendations.
Use markdown formatting with clear headings and bullet points.
Do not output JSON, code fences, or metadata—only the report.`;

/**
 * Generate a human-readable market analysis report.
 */
export async function runReportGenerator(
    provider: LLMProvider,
    context: ReportContext,
    systemPrompt?: string
): Promise<string> {
    const combinedSystemPrompt = systemPrompt
        ? `${systemPrompt}\n\n${REPORT_PROMPT}`
        : REPORT_PROMPT;
    const messages: LLMMessage[] = [
        { role: "system", content: combinedSystemPrompt },
        { role: "user", content: `Generate report for: ${JSON.stringify(context)}` },
    ];

    const response = await provider.chat(messages);
    const content = response.content.trim();

    // Check if response looks like a valid report
    if (!isLikelyJson(content) && hasMarkdownHeading(content)) {
        return response.content;
    }

    // Fallback to template-based report
    return generateReportFallback(context);
}

function isLikelyJson(content: string): boolean {
    if (!content) return false;
    if (content.startsWith("{") || content.startsWith("[")) return true;
    if (/^```(?:json)?/i.test(content)) return true;
    return false;
}

function hasMarkdownHeading(content: string): boolean {
    return /^#{1,3}\s+\S+/m.test(content);
}

function generateReportFallback(context: ReportContext): string {
    const { intent, market, regime, risk, reflection } = context;

    const timestamp = new Date().toISOString().split("T")[0];
    const confidencePercent = Math.round(reflection.confidence_score * 100);

    // Build the report sections
    const sections: string[] = [];

    // Header
    sections.push(`# ${intent.asset} Market Analysis Report`);
    sections.push(`**Date:** ${timestamp}  `);
    sections.push(`**Market:** ${intent.market.charAt(0).toUpperCase() + intent.market.slice(1)}  `);
    sections.push(`**Analysis Goal:** ${intent.analysis_goal.replace(/_/g, " ")}  `);
    sections.push(`**Timeframes:** ${intent.timeframes.join(", ")}`);
    sections.push("");

    // Executive Summary
    sections.push("## Executive Summary");
    sections.push(reflection.final_summary);
    sections.push("");

    // Market Conditions
    sections.push("## Market Conditions");
    sections.push(`- **Structure:** ${market.market_structure.replace(/_/g, " ")}`);
    sections.push(`- **Volatility:** ${market.volatility_state}`);
    sections.push(`- **Momentum:** ${market.momentum.replace(/_/g, " ")}`);
    if (market.key_levels.nearest_support) {
        sections.push(`- **Nearest Support:** ${market.key_levels.nearest_support}`);
    }
    if (market.key_levels.nearest_resistance) {
        sections.push(`- **Nearest Resistance:** ${market.key_levels.nearest_resistance}`);
    }
    sections.push("");

    // Regime Analysis
    sections.push("## Regime Analysis");
    sections.push(`- **Current Regime:** ${regime.regime.replace(/_/g, " ")}`);
    sections.push(`- **Regime Confidence:** ${Math.round(regime.confidence * 100)}%`);
    sections.push(`- **Recommended Strategy:** ${regime.recommended_strategy.replace(/_/g, " ")}`);
    sections.push(`- **Rationale:** ${regime.rationale}`);
    sections.push("");

    // Risk Assessment
    sections.push("## Risk Assessment");
    sections.push(`- **Risk Level:** ${risk.risk_level.toUpperCase()}`);
    sections.push(`- **Position Sizing:** ${risk.position_size_recommendation}`);
    sections.push(`- **Stop Loss:** ${risk.stop_loss_suggestion}`);
    if (risk.max_drawdown_warning) {
        sections.push(`- **⚠️ Warning:** ${risk.max_drawdown_warning}`);
    }
    sections.push("");

    // Recommendations
    sections.push("## Recommendations");
    const actionIcon = reflection.recommendation_strength === "strong" ? "✅" :
        reflection.recommendation_strength === "weak" ? "⚠️" : "💡";
    sections.push(`${actionIcon} **Recommendation Strength:** ${reflection.recommendation_strength.toUpperCase()}`);
    sections.push(`📊 **Overall Confidence:** ${confidencePercent}%`);
    sections.push("");

    // Action items based on regime
    if (regime.recommended_strategy === "trend_following") {
        sections.push("### Action Items");
        sections.push("- Consider position in the direction of the trend");
        sections.push("- Use trailing stops to protect gains");
        sections.push("- Monitor for trend exhaustion signals");
    } else if (regime.recommended_strategy === "mean_reversion") {
        sections.push("### Action Items");
        sections.push("- Watch for entries at key support/resistance levels");
        sections.push("- Use tight stops with defined risk");
        sections.push("- Take profits at range boundaries");
    } else if (regime.recommended_strategy === "wait") {
        sections.push("### Action Items");
        sections.push("- Avoid new entries until conditions improve");
        sections.push("- Monitor for breakout confirmation");
        sections.push("- Preserve capital for better opportunities");
    } else if (regime.recommended_strategy === "hedge") {
        sections.push("### Action Items");
        sections.push("- Consider reducing exposure");
        sections.push("- Implement protective strategies");
        sections.push("- Watch for distribution confirmation");
    }
    sections.push("");

    // Potential Blindspots
    if (reflection.potential_blindspots.length > 0) {
        sections.push("## Potential Blindspots");
        reflection.potential_blindspots.forEach((blindspot) => {
            sections.push(`- ${blindspot}`);
        });
        sections.push("");
    }

    // Alternative Scenarios
    if (reflection.alternative_scenarios.length > 0) {
        sections.push("## Alternative Scenarios");
        reflection.alternative_scenarios.forEach((scenario) => {
            sections.push(`- ${scenario}`);
        });
        sections.push("");
    }

    // Disclaimer
    sections.push("---");
    sections.push("*This analysis is for informational purposes only and does not constitute financial advice.*");

    return sections.join("\n");
}
