// Web Analyze Service - LLM-powered web content analysis

import type { LLMProvider } from "../core/llm.js";
import type { WebSearchResult } from "./webSearch.js";
import type { WebFetchResult } from "./webFetch.js";
import type { QuoteSnapshot } from "../data/types.js";

export interface WebAnalysisInput {
    query: string;
    searchResults?: WebSearchResult[];
    fetchedPages?: WebFetchResult[];
    priceSnapshot?: QuoteSnapshot;
}

export interface WebAnalysisOutput {
    summary: string;
    keyFindings: string[];
    marketData?: {
        priceInfo?: string;
        sentiment?: "bullish" | "bearish" | "neutral";
        keyEvents?: string[];
    };
    priceSnapshot?: QuoteSnapshot;
    technicalAnalysis?: {
        signal: "strong_buy" | "buy" | "hold" | "wait" | "sell" | "strong_sell";
        trend: string;
        maAlignment: string;
        macdSignal: string;
        rsiStatus: string;
        biasWarning?: string;
        buyPrice?: number;
        stopLoss?: number;
        targetPrice?: number;
        checklist?: Array<{ item: string; emoji: string }>;
        score: number;
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

If a Price Snapshot is provided, treat it as the single source of truth for current price. Do not override it with web snippets.

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

    if (input.priceSnapshot) {
        const snapshot = input.priceSnapshot;
        contentBlock += "## Price Snapshot (Trusted)\n\n";
        contentBlock += `Symbol: ${snapshot.symbol}\n`;
        contentBlock += `Price: ${snapshot.price}\n`;
        if (snapshot.currency) {
            contentBlock += `Currency: ${snapshot.currency}\n`;
        }
        if (snapshot.exchange) {
            contentBlock += `Exchange: ${snapshot.exchange}\n`;
        }
        if (snapshot.marketState) {
            contentBlock += `Market State: ${snapshot.marketState}\n`;
        }
        if (snapshot.priceType) {
            contentBlock += `Price Type: ${snapshot.priceType}\n`;
        }
        if (snapshot.timestamp) {
            contentBlock += `Timestamp: ${snapshot.timestamp}\n`;
        }
        contentBlock += `Source: ${snapshot.source}\n\n`;
    }


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
            priceSnapshot: input.priceSnapshot,
            sources,
            confidence: parsed.confidence || 0.5,
            generatedAt: new Date().toISOString(),
        };
    } catch {
        // Fallback: return raw content as summary
        return {
            summary: response.content.slice(0, 500),
            keyFindings: [],
            priceSnapshot: input.priceSnapshot,
            sources,
            confidence: 0.3,
            generatedAt: new Date().toISOString(),
        };
    }
}
/**
 * Format analysis output as professional one-page AI stock analysis report.
 * 
 * Structure:
 * - Header: Symbol + Time
 * - Decision Block: Signal + Entry/TP/SL + Logic
 * - Context: Market + Stock status
 * - Key Drivers: Technical + Events
 * - Risk: Main risks + Invalidation
 * - Footer: AI self-check + Disclaimer
 */
export function formatAnalysisReport(analysis: WebAnalysisOutput): string {
    const lines: string[] = [];
    const ta = analysis.technicalAnalysis;

    // === HEADER (10%) ===
    lines.push("# 📄 AI 股票分析报告\n");
    lines.push("---\n");
    lines.push(`📅 **${analysis.generatedAt}** | *AI Stock Trading Snapshot*\n`);

    if (analysis.priceSnapshot) {
        const snapshot = analysis.priceSnapshot;
        const currency = snapshot.currency ? ` ${snapshot.currency}` : "";
        const priceType = snapshot.priceType ? ` (${snapshot.priceType})` : "";
        const timestamp = snapshot.timestamp ? ` @ ${snapshot.timestamp}` : "";
        lines.push(`💵 **当前价格**: ${snapshot.price}${currency}${priceType} | ${snapshot.symbol} | ${snapshot.source}${timestamp}`);
        lines.push("");
    }


    // === DECISION BLOCK (25%) ===
    lines.push("## 🟦 核心结论\n");

    if (ta) {
        const signalEmoji: Record<string, string> = {
            strong_buy: "🟢", buy: "🟢", hold: "🟡", wait: "🟡", sell: "🔴", strong_sell: "🔴",
        };
        const signalLabel: Record<string, string> = {
            strong_buy: "LONG ↑↑", buy: "LONG ↑", hold: "WAIT ⏸", wait: "WAIT ⏸", sell: "SHORT ↓", strong_sell: "SHORT ↓↓",
        };
        const confidenceStars = Math.round((ta.score / 100) * 5);
        const stars = "⭐".repeat(confidenceStars) + "☆".repeat(5 - confidenceStars);

        lines.push("| 方向 & 置信度 | 交易参数 | 核心逻辑 |");
        lines.push("|:---|:---|:---|");
        lines.push(`| ${signalEmoji[ta.signal] || "⚪"} **${signalLabel[ta.signal] || ta.signal}** | 入场: ${ta.buyPrice || "-"} | ${ta.trend} |`);
        lines.push(`| ${stars} (${ta.score}/100) | 止盈: ${ta.targetPrice || "-"} | ${ta.maAlignment} |`);
        lines.push(`| **${ta.trend}** | 止损: ${ta.stopLoss || "-"} | ${ta.macdSignal} |`);
        lines.push("");

        // Checklist
        if (ta.checklist?.length) {
            lines.push("> " + ta.checklist.map(c => `${c.emoji} ${c.item}`).join(" | "));
            lines.push("");
        }
    } else {
        // Fallback for non-technical analysis
        const sentiment = analysis.marketData?.sentiment || "neutral";
        const sentimentEmoji = sentiment === "bullish" ? "🟢" : sentiment === "bearish" ? "🔴" : "🟡";
        lines.push(`${sentimentEmoji} **Signal**: ${sentiment.toUpperCase()} | **Confidence**: ${(analysis.confidence * 100).toFixed(0)}%\n`);
    }

    // === CONTEXT BLOCK (20%) ===
    lines.push("## 🟨 市场 & 个股状态\n");
    lines.push("| 市场环境 | 个股状态 |");
    lines.push("|:---|:---|");

    if (analysis.marketData) {
        const sentiment = analysis.marketData.sentiment || "neutral";
        const sentimentLabel = sentiment === "bullish" ? "Risk-On 📈" : sentiment === "bearish" ? "Risk-Off 📉" : "中性 ➖";
        lines.push(`| Regime: ${sentimentLabel} | Trend: ${ta?.trend || "待分析"} |`);
        lines.push(`| Volatility: Medium | Structure: ${ta?.maAlignment || "-"} |`);
    } else {
        lines.push("| Regime: 待分析 | Trend: 待分析 |");
        lines.push("| Volatility: - | Structure: - |");
    }
    lines.push("");

    // === KEY DRIVERS (20%) ===
    lines.push("## 🟩 关键依据\n");

    // Technical
    lines.push("### 📊 技术面");
    if (ta) {
        lines.push(`- 均线: ${ta.maAlignment}`);
        lines.push(`- MACD: ${ta.macdSignal}`);
        lines.push(`- RSI: ${ta.rsiStatus}`);
        if (ta.biasWarning) lines.push(`- ⚠️ 乖离率: ${ta.biasWarning}`);
    } else {
        lines.push("- 技术分析待获取更多数据");
    }
    lines.push("");

    // Events/Fundamental
    lines.push("### 📰 事件/基本面");
    if (analysis.keyFindings.length > 0) {
        for (const finding of analysis.keyFindings.slice(0, 4)) {
            lines.push(`- ${finding}`);
        }
    } else {
        lines.push("- 无重大事件");
    }
    lines.push("");

    // === RISK BLOCK (15%) ===
    lines.push("## 🟥 风险 & 失效条件\n");
    lines.push("### ⚠️ 主要风险");

    // Extract risks from summary or key findings
    const riskKeywords = ["风险", "risk", "警惕", "注意", "危险", "下跌", "回调", "阻力"];
    const risks = analysis.keyFindings.filter(f => riskKeywords.some(k => f.toLowerCase().includes(k)));
    if (risks.length > 0) {
        for (const risk of risks.slice(0, 2)) {
            lines.push(`- ${risk}`);
        }
    } else {
        lines.push("- 市场波动风险");
        lines.push("- 突发事件风险");
    }
    lines.push("");

    lines.push("### ❌ 失效条件");
    if (ta?.stopLoss) {
        lines.push(`- 日线收盘跌破 ${ta.stopLoss}`);
    }
    lines.push("- 市场结构破坏");
    lines.push("- 重大利空消息");
    lines.push("");

    // === SUMMARY ===
    lines.push("## 📝 分析摘要\n");
    lines.push(`> ${analysis.summary}\n`);

    // === SOURCES ===
    if (analysis.sources.length > 0) {
        lines.push("## 📚 数据来源\n");
        for (const source of analysis.sources.slice(0, 5)) {
            const label = source.title || new URL(source.url).hostname;
            lines.push(`- [${label}](${source.url})`);
        }
        lines.push("");
    }

    // === FOOTER (10%) ===
    lines.push("---\n");
    lines.push("## 🟪 AI 自检 & 免责声明\n");
    lines.push(`- **置信度**: ${(analysis.confidence * 100).toFixed(0)}%`);
    lines.push(`- **数据源**: ${analysis.sources.length} 个`);
    lines.push(`- **生成时间**: ${analysis.generatedAt}`);
    lines.push("");
    lines.push("> ⚠️ **免责声明**: 本报告由 AI 生成，仅供研究参考，不构成投资建议。投资有风险，入市需谨慎。");

    return lines.join("\n");
}

