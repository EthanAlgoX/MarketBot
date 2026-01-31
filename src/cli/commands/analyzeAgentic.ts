// Agentic Analysis Command
// Uses the agent loop to autonomously call tools and generate analysis

import { loadConfig } from "../../config/io.js";
import { createProviderFromConfigAsync } from "../../core/providers/registry.js";
import { runAgentLoop } from "../../core/agentLoop.js";
import { createDefaultToolRegistry } from "../../tools/registry.js";
import { createToolBridge } from "../../tools/toolBridge.js";
import { resolveToolAllowlist, resolveToolPolicy } from "../../tools/policy.js";
import { resolveDefaultAgentId } from "../../agents/agentScope.js";

const SYSTEM_PROMPT = `You are MarketBot, an AI-powered market analysis assistant.

Your goal is to analyze markets and provide actionable insights to users.

When a user asks for analysis:
1. First use market_fetch to get the latest market data
2. Analyze the data and generate insights
3. Use signal_analyze if trading advice is requested
4. Provide a clear, actionable response

When a user asks about portfolio:
1. Use portfolio_status to check current holdings
2. Use portfolio_add/remove to manage assets if requested

Always explain your reasoning and provide specific recommendations when appropriate.`;

function buildToolsBlock(tools: Array<{ name: string; description?: string }>): string {
    if (tools.length === 0) return "No tools available.";
    const lines = ["You have access to the following tools:"];
    for (const tool of tools) {
        const description = tool.description ? `: ${tool.description}` : "";
        lines.push(`- ${tool.name}${description}`);
    }
    return lines.join("\n");
}

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

    const provider = await createProviderFromConfigAsync(config);

    // Create tools and bridge (respect tool policy)
    const registry = await createDefaultToolRegistry();
    const allTools = registry.list();
    const agentId = resolveDefaultAgentId(config);
    const policy = resolveToolPolicy(config, agentId);
    const allowlist = resolveToolAllowlist(policy, allTools.map((tool) => tool.name));
    const allowSet = new Set(allowlist.map((name) => name.toLowerCase()));
    const tools = allTools.filter((tool) => allowSet.has(tool.name.toLowerCase()));
    if (tools.length === 0) {
        throw new Error("No tools allowed by policy.");
    }
    const bridge = createToolBridge(tools, { cwd: process.cwd(), env: process.env, agentId });
    const systemPrompt = `${SYSTEM_PROMPT}\n\n${buildToolsBlock(tools)}`;

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
        systemPrompt,
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
