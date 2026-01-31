// LLM Provider interface and implementations

import type { ToolDefinition, ToolCall, LLMToolResponse } from "./agentTypes.js";

export interface LLMMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    toolCalls?: ToolCall[];
    toolCallId?: string;
}

export interface LLMResponse {
    content: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface LLMProvider {
    chat(messages: LLMMessage[]): Promise<LLMResponse>;
    complete(prompt: string): Promise<string>;
    /** Chat with tool calling support */
    chatWithTools?(messages: LLMMessage[], tools: ToolDefinition[]): Promise<LLMToolResponse>;
}

/**
 * Mock LLM provider for testing purposes.
 * Returns deterministic responses based on input patterns.
 */
export class MockProvider implements LLMProvider {
    private responses: Map<string, string> = new Map();

    constructor(customResponses?: Record<string, string>) {
        if (customResponses) {
            for (const [key, value] of Object.entries(customResponses)) {
                this.responses.set(key.toLowerCase(), value);
            }
        }
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        const lastMessage = messages[messages.length - 1];
        const content = await this.complete(lastMessage?.content ?? "");
        return {
            content,
            usage: {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
            },
        };
    }

    async chatWithTools(messages: LLMMessage[], tools: ToolDefinition[]): Promise<LLMToolResponse> {
        const lastMessage = messages[messages.length - 1];
        const prompt = lastMessage?.content ?? "";
        const lowerPrompt = prompt.toLowerCase();

        // Check if we should call a tool based on the query
        const toolNames = tools.map(t => t.function.name);

        // Simulate tool calling behavior for market analysis
        if ((lowerPrompt.includes("分析") || lowerPrompt.includes("analyze")) &&
            toolNames.includes("market_fetch")) {
            // Extract asset from query
            let asset = "BTC";
            if (lowerPrompt.includes("google") || lowerPrompt.includes("googl")) {
                asset = "GOOGL";
            } else if (lowerPrompt.includes("btc") || lowerPrompt.includes("bitcoin")) {
                asset = "BTC";
            } else if (lowerPrompt.includes("eth") || lowerPrompt.includes("ethereum")) {
                asset = "ETH";
            }

            const market = ["GOOGL", "AAPL", "MSFT", "TSLA"].includes(asset) ? "stocks" : "crypto";

            return {
                content: null,
                toolCalls: [{
                    id: `call_${Date.now()}`,
                    name: "market_fetch",
                    arguments: JSON.stringify({
                        asset,
                        market,
                        timeframes: ["1h", "4h", "1d"],
                        mode: "mock"
                    })
                }],
                finishReason: "tool_calls",
                usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }
            };
        }

        // Check for tool results in context - generate final response
        const hasToolResult = messages.some(m => m.role === "tool");
        if (hasToolResult) {
            const toolResults = messages.filter(m => m.role === "tool");
            const lastToolContent = toolResults[toolResults.length - 1]?.content ?? "";

            // Parse tool result and generate analysis
            try {
                const data = JSON.parse(lastToolContent);
                const trend1h = data.price_structure?.trend_1h ?? "neutral";
                const trend4h = data.price_structure?.trend_4h ?? "neutral";
                const ema = data.indicators?.ema_alignment ?? "neutral";
                const rsi = data.indicators?.rsi_1h ?? 50;

                const report = `# 市场分析报告

## 技术分析摘要
- **1小时趋势**: ${trend1h}
- **4小时趋势**: ${trend4h}
- **EMA 排列**: ${ema}
- **RSI**: ${rsi}

## 建议
${rsi > 70 ? "⚠️ RSI 过高，可能超买" : rsi < 30 ? "💡 RSI 较低，可能超卖" : "📊 RSI 中性，观望为主"}

*分析完成于 ${new Date().toISOString()}*`;

                return {
                    content: report,
                    finishReason: "stop",
                    usage: { prompt_tokens: 200, completion_tokens: 150, total_tokens: 350 }
                };
            } catch {
                return {
                    content: "分析完成。市场数据显示中性态势，建议观望。",
                    finishReason: "stop",
                    usage: { prompt_tokens: 200, completion_tokens: 50, total_tokens: 250 }
                };
            }
        }

        // Default: return text response
        const content = await this.complete(prompt);
        return {
            content,
            finishReason: "stop",
            usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
        };
    }

    async complete(prompt: string): Promise<string> {
        const lowerPrompt = prompt.toLowerCase();

        // Check for custom responses
        for (const [key, value] of this.responses.entries()) {
            if (lowerPrompt.includes(key)) {
                return value;
            }
        }

        // Intent parsing detection
        if (lowerPrompt.includes("intent") || lowerPrompt.includes("parse")) {
            if (lowerPrompt.includes("google") || lowerPrompt.includes("alphabet")) {
                return JSON.stringify({
                    asset: "GOOGL",
                    market: "stock",
                    analysis_goal: "fundamental",
                    timeframes: ["1d", "1w"],
                    risk_tolerance: "medium",
                    confidence_level: "high",
                });
            }
            return JSON.stringify({
                asset: "BTC",
                market: "crypto",
                analysis_goal: "general_analysis",
                timeframes: ["1h", "4h"],
                risk_tolerance: "medium",
                confidence_level: "moderate",
            });
        }

        // Market data interpretation
        if (lowerPrompt.includes("interpret") || lowerPrompt.includes("market data")) {
            return JSON.stringify({
                market_structure: "ranging",
                volatility_state: "medium",
                momentum: "neutral",
                key_levels: { nearest_support: 40000, nearest_resistance: 45000 },
                summary: "Market is consolidating with neutral momentum.",
            });
        }

        // Market regime detection
        if (lowerPrompt.includes("regime")) {
            return JSON.stringify({
                regime: "accumulation",
                confidence: 0.7,
                recommended_strategy: "wait",
                rationale: "Market showing signs of accumulation phase.",
            });
        }

        // Risk assessment
        if (lowerPrompt.includes("risk")) {
            return JSON.stringify({
                risk_level: "medium",
                position_size_recommendation: "half",
                stop_loss_suggestion: "normal",
                rationale: "Moderate risk environment with average volatility.",
            });
        }

        // Reflection
        if (lowerPrompt.includes("reflect") || lowerPrompt.includes("review")) {
            return JSON.stringify({
                confidence_score: 0.65,
                potential_blindspots: ["Macro events", "Whale activity"],
                alternative_scenarios: ["Breakout above resistance", "Breakdown below support"],
                recommendation_strength: "moderate",
                final_summary: "Analysis suggests cautious positioning with moderate confidence.",
            });
        }

        // Web Analysis / Search Report
        if (lowerPrompt.includes("analyze this content") || lowerPrompt.includes("web content")) {
            return JSON.stringify({
                summary: "Google (Alphabet Inc.) maintains a dominant position in search and digital advertising. Recent focus has shifted to AI integration across its product suite (Gemini) to compete with Microsoft/OpenAI. Financials remain strong with steady revenue growth from Cloud and YouTube segments.",
                keyFindings: [
                    "Dominant market share in Search (>90%)",
                    "Aggressive AI integration with Gemini models",
                    "Cloud revenue growing +25% YoY",
                    "Facing antitrust scrutiny in EU and US"
                ],
                marketData: {
                    priceInfo: "$175.50 USD",
                    sentiment: "bullish",
                    keyEvents: ["Gemini 1.5 Pro launch", "Quarterly Earnings Beat"]
                },
                technicalAnalysis: {
                    signal: "buy",
                    trend: "Uptrend",
                    maAlignment: "Bullish",
                    macdSignal: "Positive Crossover",
                    rsiStatus: "Neutral (55)",
                    buyPrice: 172.00,
                    targetPrice: 195.00,
                    stopLoss: 165.00,
                    score: 85
                },
                confidence: 0.9
            });
        }

        // Report generation
        if (lowerPrompt.includes("report") || lowerPrompt.includes("generate")) {
            return `# Market Analysis Report

## Summary
Based on current market conditions, the asset shows neutral momentum with moderate volatility.

## Key Findings
- Market Structure: Ranging
- Trend Bias: Neutral
- Risk Level: Medium

## Recommendation
Consider waiting for clearer signals before entering new positions.`;
        }

        // Default response
        return "Mock LLM response: Analysis complete.";
    }
}
