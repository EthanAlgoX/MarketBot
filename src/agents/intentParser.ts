// Intent Parser Agent - extracts structured intent from user queries

import type { LLMProvider, LLMMessage } from "../core/llm.js";
import type { IntentParsingOutput } from "../core/types.js";
import { resolveSymbolFromText } from "../utils/symbols.js";
import { tryParseJson } from "./jsonUtils.js";

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
        { role: "system", content: INTENT_PARSER_PROMPT },
        { role: "user", content: `Parse this query: "${userQuery}"` },
    ];

    const response = await provider.chat(messages);

    const parsed = tryParseJson<Partial<IntentParsingOutput>>(response.content);
    if (parsed) {
        return validateIntent(parsed, userQuery);
    }

    // Fallback to default parsing
    return parseQueryFallback(userQuery);
}

function validateIntent(parsed: Partial<IntentParsingOutput>, query: string): IntentParsingOutput {
    const fallback = parseQueryFallback(query);
    return {
        asset: parsed.asset ?? fallback.asset,
        market: normalizeMarket(parsed.market) ?? fallback.market,
        analysis_goal: parsed.analysis_goal ?? fallback.analysis_goal,
        timeframes: parsed.timeframes ?? fallback.timeframes,
        risk_tolerance: parsed.risk_tolerance ?? fallback.risk_tolerance,
        confidence_level: parsed.confidence_level ?? fallback.confidence_level,
    };
}

function parseQueryFallback(query: string): IntentParsingOutput {
    const lowerQuery = query.toLowerCase();

    // Detect asset
    const resolvedSymbol = resolveSymbolFromText(query);
    let asset = resolvedSymbol ?? "BTC";

    const cryptoNameMap: Array<[string, string]> = [
        ["bitcoin", "BTC"],
        ["btc", "BTC"],
        ["ethereum", "ETH"],
        ["eth", "ETH"],
        ["solana", "SOL"],
        ["sol", "SOL"],
        ["xrp", "XRP"],
        ["ada", "ADA"],
        ["cardano", "ADA"],
        ["dogecoin", "DOGE"],
        ["doge", "DOGE"],
        ["bnb", "BNB"],
        ["binance", "BNB"],
    ];

    if (!resolvedSymbol) {
        for (const [name, symbol] of cryptoNameMap) {
            if (lowerQuery.includes(name)) {
                asset = symbol;
                break;
            }
        }
    }

    const cryptoAssets = new Set(["BTC", "ETH", "SOL", "XRP", "ADA", "BNB", "DOGE"]);
    const cryptoCues = ["crypto", "bitcoin", "btc", "ethereum", "eth", "altcoin"];
    const forexCues = ["forex", "fx", "currency", "exchange rate"];
    const futuresCues = ["futures", "future", "contract"];
    const commodityCues = ["commodity", "gold", "silver", "oil", "wti", "brent", "copper", "natural gas"];
    const stockCues = ["stock", "stocks", "equity", "shares", "share", "nasdaq", "nyse", "earnings", "ticker"];

    // Detect market
    let market: IntentParsingOutput["market"] = "crypto";
    if (cryptoCues.some((cue) => lowerQuery.includes(cue)) || cryptoAssets.has(asset)) {
        market = "crypto";
    } else if (forexCues.some((cue) => lowerQuery.includes(cue))) {
        market = "forex";
    } else if (futuresCues.some((cue) => lowerQuery.includes(cue))) {
        market = "futures";
    } else if (commodityCues.some((cue) => lowerQuery.includes(cue))) {
        market = "commodities";
    } else if (stockCues.some((cue) => lowerQuery.includes(cue))) {
        market = "stocks";
    } else if (asset && !cryptoAssets.has(asset)) {
        market = "stocks";
    }

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

function normalizeMarket(value?: string): IntentParsingOutput["market"] | undefined {
    if (!value) return undefined;
    const normalized = value.toLowerCase();
    if (normalized === "stock" || normalized === "stocks" || normalized === "equity") return "stocks";
    if (normalized === "crypto" || normalized === "cryptocurrency" || normalized === "cryptocurrencies") return "crypto";
    if (normalized === "forex" || normalized === "fx" || normalized === "currency") return "forex";
    if (normalized === "commodities" || normalized === "commodity") return "commodities";
    if (normalized === "futures" || normalized === "future") return "futures";
    return undefined;
}
