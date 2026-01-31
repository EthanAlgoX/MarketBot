// Web Analyze Service - LLM-powered web content analysis

import type { LLMProvider } from "../core/llm.js";
import type { WebSearchResult } from "./webSearch.js";
import type { WebFetchResult } from "./webFetch.js";

export interface WebAnalysisInput {
    query: string;
    searchResults?: WebSearchResult[];
    fetchedPages?: WebFetchResult[];
}

export interface WebAnalysisOutput {
    summary: string;
    keyFindings: string[];
    marketData?: {
        priceInfo?: string;
        sentiment?: "bullish" | "bearish" | "neutral";
        keyEvents?: string[];
    };
    sources: Array<{
        title?: string;
        url: string;
    }>;
    confidence: number;
    generatedAt: string;
}

const ANALYSIS_PROMPT = `You are a financial data analyst. Analyze the provided web content and extract market-relevant information.

Task: Analyze the following web search results and/or fetched pages related to the user's query.

Output a JSON object with:
{
  "summary": "Brief 2-3 sentence summary of the key information",
  "keyFindings": ["Finding 1", "Finding 2", ...],
  "marketData": {
    "priceInfo": "Current price or price movement info if available",
    "sentiment": "bullish" | "bearish" | "neutral",
    "keyEvents": ["Event 1", "Event 2", ...]
  },
  "confidence": 0.0-1.0 (how confident you are in the analysis)
}

Focus on:
- Price levels and movements
- Market sentiment and trends
- News events affecting the asset
- Trading volume and liquidity
- Technical and fundamental factors`;

export async function analyzeWebContent(
    provider: LLMProvider,
    input: WebAnalysisInput,
): Promise<WebAnalysisOutput> {
    const sources: Array<{ title?: string; url: string }> = [];
    let contentBlock = "";

    if (input.searchResults?.length) {
        contentBlock += "## Search Results\n\n";
        for (const result of input.searchResults) {
            contentBlock += `### Query: ${result.query}\n`;
            contentBlock += `${result.content}\n\n`;
            if (result.citations?.length) {
                contentBlock += "Citations:\n";
                for (const citation of result.citations) {
                    contentBlock += `- ${citation}\n`;
                    sources.push({ url: citation });
                }
            }
            contentBlock += "\n";
        }
    }

    if (input.fetchedPages?.length) {
        contentBlock += "## Fetched Pages\n\n";
        for (const page of input.fetchedPages) {
            contentBlock += `### ${page.title || page.url}\n`;
            contentBlock += `URL: ${page.url}\n`;
            contentBlock += `${page.text.slice(0, 5000)}\n\n`;
            sources.push({ title: page.title, url: page.url });
        }
    }

    const userMessage = `User Query: ${input.query}

${contentBlock}

Analyze this content and provide a structured JSON response.`;

    const response = await provider.chat([
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: userMessage },
    ]);

    try {
        // Extract JSON from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No JSON found in response");
        }
        const parsed = JSON.parse(jsonMatch[0]) as {
            summary: string;
            keyFindings: string[];
            marketData?: {
                priceInfo?: string;
                sentiment?: "bullish" | "bearish" | "neutral";
                keyEvents?: string[];
            };
            confidence: number;
        };

        return {
            summary: parsed.summary || "No summary available",
            keyFindings: parsed.keyFindings || [],
            marketData: parsed.marketData,
            sources,
            confidence: parsed.confidence || 0.5,
            generatedAt: new Date().toISOString(),
        };
    } catch {
        // Fallback: return raw content as summary
        return {
            summary: response.content.slice(0, 500),
            keyFindings: [],
            sources,
            confidence: 0.3,
            generatedAt: new Date().toISOString(),
        };
    }
}

/**
 * Format analysis output as markdown report.
 */
export function formatAnalysisReport(analysis: WebAnalysisOutput): string {
    const lines: string[] = [];

    lines.push("# Web Analysis Report\n");
    lines.push(`Generated: ${analysis.generatedAt}\n`);

    lines.push("## Summary\n");
    lines.push(`${analysis.summary}\n`);

    if (analysis.keyFindings.length > 0) {
        lines.push("## Key Findings\n");
        for (const finding of analysis.keyFindings) {
            lines.push(`- ${finding}`);
        }
        lines.push("");
    }

    if (analysis.marketData) {
        lines.push("## Market Data\n");
        if (analysis.marketData.priceInfo) {
            lines.push(`**Price Info**: ${analysis.marketData.priceInfo}\n`);
        }
        if (analysis.marketData.sentiment) {
            const sentimentEmoji =
                analysis.marketData.sentiment === "bullish"
                    ? "🟢"
                    : analysis.marketData.sentiment === "bearish"
                        ? "🔴"
                        : "⚪";
            lines.push(`**Sentiment**: ${sentimentEmoji} ${analysis.marketData.sentiment}\n`);
        }
        if (analysis.marketData.keyEvents?.length) {
            lines.push("**Key Events**:");
            for (const event of analysis.marketData.keyEvents) {
                lines.push(`- ${event}`);
            }
            lines.push("");
        }
    }

    if (analysis.sources.length > 0) {
        lines.push("## Sources\n");
        for (const source of analysis.sources.slice(0, 10)) {
            const label = source.title || source.url;
            lines.push(`- [${label}](${source.url})`);
        }
        lines.push("");
    }

    lines.push(`---`);
    lines.push(`Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);

    return lines.join("\n");
}
