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
    language?: "zh" | "en";
}

// ... (skipping unchanged parts)




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

    const languageInstruction = input.language === "en"
        ? "IMPORTANT: Provide the output in English."
        : "IMPORTANT: Provide the output in Chinese (Simplified).";

    const userMessage = `User Query: ${input.query}

${contentBlock}

Analyze this content and provide a structured JSON response.
${languageInstruction}`;

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

        let marketData = parsed.marketData ? { ...parsed.marketData } : undefined;
        if (input.priceSnapshot) {
            const snapshot = input.priceSnapshot;
            const currency = snapshot.currency ? ` ${snapshot.currency}` : "";
            const priceType = snapshot.priceType ? ` (${snapshot.priceType})` : "";
            const timestamp = snapshot.timestamp ? ` @ ${snapshot.timestamp}` : "";
            const priceInfo = `${snapshot.price}${currency}${priceType}${timestamp}`;
            if (marketData) {
                marketData.priceInfo = priceInfo;
            } else {
                marketData = { priceInfo };
            }
        }

        return {
            summary: parsed.summary || "No summary available",
            keyFindings: parsed.keyFindings || [],
            marketData,
            priceSnapshot: input.priceSnapshot,
            sources,
            confidence: parsed.confidence || 0.5,
            generatedAt: new Date().toISOString(),
        };
    } catch {
        // Fallback: return raw content as summary
        const fallbackMarketData = input.priceSnapshot
            ? { priceInfo: `${input.priceSnapshot.price}${input.priceSnapshot.currency ? ` ${input.priceSnapshot.currency}` : ""}` }
            : undefined;

        return {
            summary: response.content.slice(0, 500),
            keyFindings: [],
            marketData: fallbackMarketData,
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
const REPORT_STRINGS = {
    zh: {
        header: "# 📄 AI 股票分析报告",
        snapshot: "AI Stock Trading Snapshot",
        currentPrice: "当前价格",
        coreConclusion: "## 🟦 核心结论",
        columns: "| 方向 & 置信度 | 交易参数 | 核心逻辑 |",
        longUp: "LONG ↑",
        longUpUp: "LONG ↑↑",
        wait: "WAIT ⏸",
        shortDown: "SHORT ↓",
        shortDownDown: "SHORT ↓↓",
        entry: "入场",
        tp: "止盈",
        sl: "止损",
        marketStatus: "## 🟨 市场 & 个股状态",
        marketCols: "| 市场环境 | 个股状态 |",
        regime: "Regime",
        trend: "Trend",
        volatility: "Volatility",
        structure: "Structure",
        analyzing: "待分析",
        keyDrivers: "## 🟩 关键依据",
        technical: "### 📊 技术面",
        ma: "均线",
        macd: "MACD",
        rsi: "RSI",
        bias: "⚠️ 乖离率",
        noTech: "技术分析待获取更多数据",
        events: "### 📰 事件/基本面",
        noEvents: "无重大事件",
        risks: "## 🟥 风险 & 失效条件",
        mainRisks: "### ⚠️ 主要风险",
        marketRisk: "市场波动风险",
        eventRisk: "突发事件风险",
        invalidation: "### ❌ 失效条件",
        breakBelow: "日线收盘跌破",
        structBreak: "市场结构破坏",
        badNews: "重大利空消息",
        summary: "## 📝 分析摘要",
        sources: "## 📚 数据来源",
        selfCheck: "## 🟪 AI 自检 & 免责声明",
        confidence: "置信度",
        sourceCount: "数据源",
        generatedAt: "生成时间",
        disclaimer: "> ⚠️ **免责声明**: 本报告由 AI 生成，仅供研究参考，不构成投资建议。投资有风险，入市需谨慎。"
    },
    en: {
        header: "# 📄 AI Stock Analysis Report",
        snapshot: "AI Stock Trading Snapshot",
        currentPrice: "Current Price",
        coreConclusion: "## 🟦 Core Conclusion",
        columns: "| Direction & Confidence | Params | Rationale |",
        longUp: "LONG ↑",
        longUpUp: "LONG ↑↑",
        wait: "WAIT ⏸",
        shortDown: "SHORT ↓",
        shortDownDown: "SHORT ↓↓",
        entry: "Entry",
        tp: "TP",
        sl: "SL",
        marketStatus: "## 🟨 Market & Status",
        marketCols: "| Regime | Status |",
        regime: "Regime",
        trend: "Trend",
        volatility: "Volatility",
        structure: "Structure",
        analyzing: "Analyzing",
        keyDrivers: "## 🟩 Key Drivers",
        technical: "### 📊 Technicals",
        ma: "MA",
        macd: "MACD",
        rsi: "RSI",
        bias: "⚠️ Bias",
        noTech: "More data needed",
        events: "### 📰 Events/Fundamentals",
        noEvents: "No major events",
        risks: "## 🟥 Risks & Invalidation",
        mainRisks: "### ⚠️ Main Risks",
        marketRisk: "Market Volatility",
        eventRisk: "Unexpected Events",
        invalidation: "### ❌ Invalidation",
        breakBelow: "Close below",
        structBreak: "Structure Break",
        badNews: "Negative News",
        summary: "## 📝 Summary",
        sources: "## 📚 Sources",
        selfCheck: "## 🟪 Meta Data & Disclaimer",
        confidence: "Confidence",
        sourceCount: "Sources",
        generatedAt: "Generated At",
        disclaimer: "> ⚠️ **Disclaimer**: Generated by AI for research only. Not financial advice. Trading involves risk."
    }
};

export function formatAnalysisReport(analysis: WebAnalysisOutput, language: "zh" | "en" = "zh"): string {
    const lines: string[] = [];
    const ta = analysis.technicalAnalysis;
    const txt = REPORT_STRINGS[language];

    // === HEADER (10%) ===
    lines.push(`${txt.header}\n`);
    lines.push("---\n");
    lines.push(`📅 **${analysis.generatedAt}** | *${txt.snapshot}*\n`);

    if (analysis.priceSnapshot) {
        const snapshot = analysis.priceSnapshot;
        const currency = snapshot.currency ? ` ${snapshot.currency}` : "";
        const priceType = snapshot.priceType ? ` (${snapshot.priceType})` : "";
        const timestamp = snapshot.timestamp ? ` @ ${snapshot.timestamp}` : "";
        lines.push(`💵 **${txt.currentPrice}**: ${snapshot.price}${currency}${priceType} | ${snapshot.symbol} | ${snapshot.source}${timestamp}`);
        lines.push("");
    }


    // === DECISION BLOCK (25%) ===
    lines.push(`${txt.coreConclusion}\n`);

    if (ta) {
        const signalEmoji: Record<string, string> = {
            strong_buy: "🟢", buy: "🟢", hold: "🟡", wait: "🟡", sell: "🔴", strong_sell: "🔴",
        };
        const signalLabel: Record<string, string> = {
            strong_buy: txt.longUpUp, buy: txt.longUp, hold: txt.wait, wait: txt.wait, sell: txt.shortDown, strong_sell: txt.shortDownDown,
        };
        const confidenceStars = Math.round((ta.score / 100) * 5);
        const stars = "⭐".repeat(confidenceStars) + "☆".repeat(5 - confidenceStars);

        lines.push(txt.columns);
        lines.push("|:---|:---|:---|");
        lines.push(`| ${signalEmoji[ta.signal] || "⚪"} **${signalLabel[ta.signal] || ta.signal}** | ${txt.entry}: ${ta.buyPrice || "-"} | ${ta.trend} |`);
        lines.push(`| ${stars} (${ta.score}/100) | ${txt.tp}: ${ta.targetPrice || "-"} | ${ta.maAlignment} |`);
        lines.push(`| **${ta.trend}** | ${txt.sl}: ${ta.stopLoss || "-"} | ${ta.macdSignal} |`);
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
    lines.push(`${txt.marketStatus}\n`);
    lines.push(txt.marketCols);
    lines.push("|:---|:---|");

    if (analysis.marketData) {
        const sentiment = analysis.marketData.sentiment || "neutral";
        const sentimentLabel = sentiment === "bullish" ? "Risk-On 📈" : sentiment === "bearish" ? "Risk-Off 📉" : "Neutral ➖";
        lines.push(`| ${txt.regime}: ${sentimentLabel} | ${txt.trend}: ${ta?.trend || txt.analyzing} |`);
        lines.push(`| ${txt.volatility}: Medium | ${txt.structure}: ${ta?.maAlignment || "-"} |`);
    } else {
        lines.push(`| ${txt.regime}: ${txt.analyzing} | ${txt.trend}: ${txt.analyzing} |`);
        lines.push(`| ${txt.volatility}: - | ${txt.structure}: - |`);
    }
    lines.push("");

    // === KEY DRIVERS (20%) ===
    lines.push(`${txt.keyDrivers}\n`);

    // Technical
    lines.push(txt.technical);
    if (ta) {
        lines.push(`- ${txt.ma}: ${ta.maAlignment}`);
        lines.push(`- ${txt.macd}: ${ta.macdSignal}`);
        lines.push(`- ${txt.rsi}: ${ta.rsiStatus}`);
        if (ta.biasWarning) lines.push(`- ${txt.bias}: ${ta.biasWarning}`);
    } else {
        lines.push(`- ${txt.noTech}`);
    }
    lines.push("");

    // Events/Fundamental
    lines.push(txt.events);
    if (analysis.keyFindings.length > 0) {
        for (const finding of analysis.keyFindings.slice(0, 4)) {
            lines.push(`- ${finding}`);
        }
    } else {
        lines.push(`- ${txt.noEvents}`);
    }
    lines.push("");

    // === RISK BLOCK (15%) ===
    lines.push(`${txt.risks}\n`);
    lines.push(txt.mainRisks);

    // Extract risks from summary or key findings
    const riskKeywords = language === "zh"
        ? ["风险", "risk", "警惕", "注意", "危险", "下跌", "回调", "阻力"]
        : ["risk", "caution", "danger", "downside", "resistance", "correction", "monitor"];

    const risks = analysis.keyFindings.filter(f => riskKeywords.some(k => f.toLowerCase().includes(k)));
    if (risks.length > 0) {
        for (const risk of risks.slice(0, 2)) {
            lines.push(`- ${risk}`);
        }
    } else {
        lines.push(`- ${txt.marketRisk}`);
        lines.push(`- ${txt.eventRisk}`);
    }
    lines.push("");

    lines.push(txt.invalidation);
    if (ta?.stopLoss) {
        lines.push(`- ${txt.breakBelow} ${ta.stopLoss}`);
    }
    lines.push(`- ${txt.structBreak}`);
    lines.push(`- ${txt.badNews}`);
    lines.push("");

    // === SUMMARY ===
    lines.push(`${txt.summary}\n`);
    lines.push(`> ${analysis.summary}\n`);

    // === SOURCES ===
    if (analysis.sources.length > 0) {
        lines.push(`${txt.sources}\n`);
        for (const source of analysis.sources.slice(0, 5)) {
            const label = source.title || new URL(source.url).hostname;
            lines.push(`- [${label}](${source.url})`);
        }
        lines.push("");
    }

    // === FOOTER (10%) ===
    lines.push("---\n");
    lines.push(`${txt.selfCheck}\n`);
    lines.push(`- **${txt.confidence}**: ${(analysis.confidence * 100).toFixed(0)}%`);
    lines.push(`- **${txt.sourceCount}**: ${analysis.sources.length}`);
    lines.push(`- **${txt.generatedAt}**: ${analysis.generatedAt}`);
    lines.push("");
    lines.push(txt.disclaimer);

    return lines.join("\n");
}

