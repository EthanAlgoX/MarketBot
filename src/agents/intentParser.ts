// Intent Parser Agent - extracts structured intent from user queries

import type { LLMProvider, LLMMessage } from "../core/llm.js";
import type { IntentParsingOutput } from "../core/types.js";

const INTENT_PARSER_PROMPT = `You are an intent parser for a market analysis system.
Parse the user's query and extract:
- asset: The asset being analyzed (e.g., BTC, ETH, AAPL)
- market: One of "crypto", "forex", "stocks", "commodities", "futures"
- analysis_goal: One of "entry_signal", "exit_signal", "risk_check", "general_analysis"
- timeframes: Array of timeframes (e.g., ["1h", "4h", "1d"])
- risk_tolerance: One of "low", "medium", "high"
- confidence_level: One of "exploratory", "moderate", "high_conviction"

Respond with valid JSON only.`;

/**
 * Parse user query to extract analysis intent.
 */
export async function runIntentParser(
    provider: LLMProvider,
    userQuery: string,
    systemPrompt?: string
): Promise<IntentParsingOutput> {
    const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt ?? INTENT_PARSER_PROMPT },
        { role: "user", content: `Parse this query: "${userQuery}"` },
    ];

    const response = await provider.chat(messages);

    try {
        const parsed = JSON.parse(response.content) as IntentParsingOutput;
        return validateIntent(parsed);
    } catch {
        // Fallback to default parsing
        return parseQueryFallback(userQuery);
    }
}

function validateIntent(parsed: Partial<IntentParsingOutput>): IntentParsingOutput {
    return {
        asset: parsed.asset ?? "BTC",
        market: parsed.market ?? "crypto",
        analysis_goal: parsed.analysis_goal ?? "general_analysis",
        timeframes: parsed.timeframes ?? ["1h", "4h"],
        risk_tolerance: parsed.risk_tolerance ?? "medium",
        confidence_level: parsed.confidence_level ?? "moderate",
    };
}

function parseQueryFallback(query: string): IntentParsingOutput {
    const lowerQuery = query.toLowerCase();

    // Detect asset
    let asset = "BTC";
    const cryptoAssets = ["btc", "bitcoin", "eth", "ethereum", "sol", "solana", "xrp", "ada"];
    const stockAssets = ["aapl", "apple", "googl", "google", "msft", "microsoft", "tsla", "tesla"];

    for (const crypto of cryptoAssets) {
        if (lowerQuery.includes(crypto)) {
            asset = crypto === "bitcoin" ? "BTC" : crypto === "ethereum" ? "ETH" : crypto.toUpperCase();
            break;
        }
    }

    // Detect market
    let market: IntentParsingOutput["market"] = "crypto";
    if (stockAssets.some((s) => lowerQuery.includes(s))) market = "stocks";
    if (lowerQuery.includes("forex") || lowerQuery.includes("currency")) market = "forex";

    // Detect analysis goal
    let analysisGoal: IntentParsingOutput["analysis_goal"] = "general_analysis";
    if (lowerQuery.includes("entry") || lowerQuery.includes("buy")) analysisGoal = "entry_signal";
    if (lowerQuery.includes("exit") || lowerQuery.includes("sell")) analysisGoal = "exit_signal";
    if (lowerQuery.includes("risk")) analysisGoal = "risk_check";

    // Detect timeframes
    const timeframes: string[] = [];
    if (lowerQuery.includes("short") || lowerQuery.includes("scalp")) timeframes.push("5m", "15m", "1h");
    else if (lowerQuery.includes("long") || lowerQuery.includes("swing")) timeframes.push("4h", "1d");
    else timeframes.push("1h", "4h");

    return {
        asset,
        market,
        analysis_goal: analysisGoal,
        timeframes,
        risk_tolerance: "medium",
        confidence_level: "moderate",
    };
}
