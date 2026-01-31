// Agent Loop: LLM ↔ Tool Execution Cycle
// Implements the agentic loop where LLM can autonomously call tools

import type { LLMProvider, LLMMessage } from "./llm.js";
import type {
    ToolDefinition,
    ToolCall,
    ToolCallResult,
    AgentLoopConfig,
    LLMToolResponse,
} from "./agentTypes.js";

const DEFAULT_MAX_ITERATIONS = 10;

/**
 * Result of running the agent loop
 */
export interface AgentLoopResult {
    /** Final text response from the LLM */
    finalResponse: string;
    /** Full conversation history */
    messages: LLMMessage[];
    /** Number of iterations completed */
    iterations: number;
    /** Whether the loop completed normally */
    completed: boolean;
    /** Error message if the loop failed */
    error?: string;
    /** All tool calls made during the loop */
    toolCalls: ToolCallResult[];
}

export interface AgentLoopOptions {
    /** LLM provider with chatWithTools support */
    provider: LLMProvider;
    /** Tool definitions for the LLM */
    tools: ToolDefinition[];
    /** Function to execute a tool call and return the result */
    toolRunner: (call: ToolCall) => Promise<ToolCallResult>;
    /** System prompt for the agent */
    systemPrompt: string;
    /** User query to start the conversation */
    userQuery: string;
    /** Optional configuration */
    config?: AgentLoopConfig;
}

/**
 * Run the agent loop: LLM thinks → calls tools → gets results → thinks again
 * until it produces a final text response or max iterations reached.
 */
export async function runAgentLoop(options: AgentLoopOptions): Promise<AgentLoopResult> {
    const {
        provider,
        tools,
        toolRunner,
        systemPrompt,
        userQuery,
        config = {},
    } = options;

    const maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const startTime = Date.now();

    // Initialize messages
    const messages: LLMMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery },
    ];

    const allToolCalls: ToolCallResult[] = [];
    let iterations = 0;
    let finalResponse = "";
    let completed = false;
    let error: string | undefined;

    // Check if provider supports tool calling
    if (!provider.chatWithTools) {
        return {
            finalResponse: "",
            messages: [],
            iterations: 0,
            completed: false,
            error: "LLM provider does not support tool calling (chatWithTools method missing)",
            toolCalls: [],
        };
    }

    try {
        while (iterations < maxIterations) {
            // Check timeout
            if (config.timeoutMs && Date.now() - startTime > config.timeoutMs) {
                error = `Agent loop timed out after ${config.timeoutMs}ms`;
                break;
            }

            // Check abort signal
            if (config.abortSignal?.aborted) {
                error = "Agent loop aborted";
                break;
            }

            iterations++;

            // Call LLM with tools
            let response: LLMToolResponse;
            try {
                response = await provider.chatWithTools(messages, tools);
            } catch (err) {
                error = `LLM call failed: ${err instanceof Error ? err.message : String(err)}`;
                break;
            }

            // Notify about assistant message
            config.onAssistantMessage?.(response.content, response.toolCalls);

            // Add assistant message to history
            messages.push({
                role: "assistant",
                content: response.content,
                toolCalls: response.toolCalls,
            });

            // Check if LLM wants to call tools
            if (response.toolCalls && response.toolCalls.length > 0) {
                // Execute each tool call
                for (const call of response.toolCalls) {
                    let result: ToolCallResult;
                    try {
                        result = await toolRunner(call);
                    } catch (err) {
                        result = {
                            callId: call.id,
                            name: call.name,
                            ok: false,
                            output: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`,
                        };
                    }

                    allToolCalls.push(result);
                    config.onToolCall?.(call, result);

                    // Add tool result to messages
                    messages.push({
                        role: "tool",
                        toolCallId: call.id,
                        content: result.output,
                    });
                }
                // Continue loop - LLM will process tool results
            } else {
                // No tool calls - LLM is done
                finalResponse = response.content ?? "";
                completed = true;
                break;
            }
        }

        if (!completed && !error) {
            error = `Max iterations (${maxIterations}) reached`;
        }
    } catch (err) {
        error = `Agent loop error: ${err instanceof Error ? err.message : String(err)}`;
    }

    return {
        finalResponse,
        messages,
        iterations,
        completed,
        error,
        toolCalls: allToolCalls,
    };
}
