// Agentic Analysis Command
// Uses the agent loop to autonomously call tools and generate analysis

import { loadConfig } from "../config/io.js";
import { createProviderFromConfig } from "../core/providers/registry.js";
import { runAgentLoop } from "../core/agentLoop.js";
import { createMarketBotTools } from "../tools/marketbot.js";
import { createToolBridge } from "../tools/toolBridge.js";

const SYSTEM_PROMPT = `You are MarketBot, an AI-powered market analysis assistant.

Your goal is to analyze markets and provide actionable insights to users.

You have access to the following tools:
- market_fetch: Fetch market data and compute indicators from live sources
- indicators_compute: Compute market indicators from OHLCV series
- report_render: Generate a full analysis report
- market_summary: Create a concise market summary

When a user asks for analysis:
1. First use market_fetch to get the latest market data
2. Analyze the data and generate insights
3. Provide a clear, actionable response

Always explain your reasoning and provide specific recommendations when appropriate.`;

export interface AgenticAnalyzeOptions {
    query: string;
    maxIterations?: number;
    verbose?: boolean;
    onToolCall?: (toolName: string, args: string) => void;
}

export interface AgenticAnalyzeResult {
    response: string;
    iterations: number;
    toolCalls: Array<{ name: string; ok: boolean; output: string }>;
    completed: boolean;
    error?: string;
}

/**
 * Run an agentic analysis that autonomously decides which tools to call
 */
export async function runAgenticAnalysis(
    options: AgenticAnalyzeOptions
): Promise<AgenticAnalyzeResult> {
    const { query, maxIterations = 10, verbose = false, onToolCall } = options;

    // Load config and create provider
    const config = await loadConfig(process.cwd(), { validate: true });
    const provider = createProviderFromConfig(config);

    // Create tools and bridge
    const tools = createMarketBotTools();
    const bridge = createToolBridge(tools);

    if (verbose) {
        console.log(`\n🤖 Starting agentic analysis...`);
        console.log(`📝 Query: ${query}`);
        console.log(`🔧 Available tools: ${tools.map(t => t.name).join(", ")}\n`);
    }

    // Run agent loop
    const result = await runAgentLoop({
        provider,
        tools: bridge.definitions,
        toolRunner: async (call) => {
            if (verbose) {
                console.log(`🔧 Calling tool: ${call.name}`);
                console.log(`   Args: ${call.arguments}`);
            }
            onToolCall?.(call.name, call.arguments);

            const toolResult = await bridge.runner(call);

            if (verbose) {
                console.log(`   Result: ${toolResult.ok ? "✅" : "❌"} ${toolResult.output.substring(0, 100)}...`);
            }

            return toolResult;
        },
        systemPrompt: SYSTEM_PROMPT,
        userQuery: query,
        config: {
            maxIterations,
            onAssistantMessage: (content, toolCalls) => {
                if (verbose && content) {
                    console.log(`\n💬 Assistant: ${content.substring(0, 200)}${content.length > 200 ? "..." : ""}`);
                }
                if (verbose && toolCalls) {
                    console.log(`   Requesting ${toolCalls.length} tool call(s)`);
                }
            },
        },
    });

    return {
        response: result.finalResponse,
        iterations: result.iterations,
        toolCalls: result.toolCalls.map(tc => ({
            name: tc.name,
            ok: tc.ok,
            output: tc.output.substring(0, 500),
        })),
        completed: result.completed,
        error: result.error,
    };
}
