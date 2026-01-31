// Agent Loop - Standard agent execution cycle

import type { LLMProvider } from "../core/llm.js";

/**
 * Agent loop step types
 */
export enum AgentStep {
    RECEIVE_REQUEST = "receive_request",
    BUILD_CONTEXT = "build_context",
    LLM_INFERENCE = "llm_inference",
    TOOL_EXECUTION = "tool_execution",
    GENERATE_REPLY = "generate_reply",
    WRITE_SESSION = "write_session",
}

/**
 * Tool call definition
 */
export interface ToolCall {
    name: string;
    args: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
    name: string;
    success: boolean;
    result?: unknown;
    error?: string;
    durationMs: number;
}

/**
 * Agent loop context
 */
export interface AgentLoopContext {
    requestId: string;
    agentId: string;
    sessionKey: string;
    query: string;

    // Assembled context
    systemPrompt?: string;
    history?: Array<{ role: string; content: string }>;

    // Execution state
    currentStep: AgentStep;
    toolCalls: ToolCall[];
    toolResults: ToolResult[];

    // Timing
    startTime: number;
    stepTimes: Record<AgentStep, number>;
}

/**
 * Agent loop hooks
 */
export interface AgentLoopHooks {
    onStepStart?: (ctx: AgentLoopContext, step: AgentStep) => void;
    onStepComplete?: (ctx: AgentLoopContext, step: AgentStep) => void;
    onToolCall?: (ctx: AgentLoopContext, tool: ToolCall) => boolean; // return false to block
    onToolResult?: (ctx: AgentLoopContext, result: ToolResult) => void;
    onComplete?: (ctx: AgentLoopContext, response: string) => void;
    onError?: (ctx: AgentLoopContext, error: Error) => void;
}

/**
 * Tool executor interface
 */
export interface ToolExecutor {
    execute(name: string, args: Record<string, unknown>): Promise<unknown>;
    isAllowed(name: string): boolean;
    listTools(): string[];
}

/**
 * Agent Loop - Standard execution cycle
 * 
 * Flow: request → context → LLM → tools → reply → session
 */
export class AgentLoop {
    private provider: LLMProvider;
    private toolExecutor?: ToolExecutor;
    private hooks: AgentLoopHooks;

    constructor(
        provider: LLMProvider,
        toolExecutor?: ToolExecutor,
        hooks: AgentLoopHooks = {},
    ) {
        this.provider = provider;
        this.toolExecutor = toolExecutor;
        this.hooks = hooks;
    }

    /**
     * Execute agent loop for a request
     */
    async execute(
        requestId: string,
        agentId: string,
        sessionKey: string,
        query: string,
        options?: {
            systemPrompt?: string;
            history?: Array<{ role: string; content: string }>;
            maxToolIterations?: number;
        },
    ): Promise<{ response: string; toolResults: ToolResult[]; durationMs: number }> {
        const ctx: AgentLoopContext = {
            requestId,
            agentId,
            sessionKey,
            query,
            systemPrompt: options?.systemPrompt,
            history: options?.history || [],
            currentStep: AgentStep.RECEIVE_REQUEST,
            toolCalls: [],
            toolResults: [],
            startTime: Date.now(),
            stepTimes: {} as Record<AgentStep, number>,
        };

        try {
            // Step 1: Receive request
            await this.runStep(ctx, AgentStep.RECEIVE_REQUEST, async () => {
                // Request already received
            });

            // Step 2: Build context
            await this.runStep(ctx, AgentStep.BUILD_CONTEXT, async () => {
                // Context already provided, could add workspace injection here
            });

            // Step 3-4: LLM inference + tool execution loop
            let response = "";
            const maxIterations = options?.maxToolIterations || 5;
            let iteration = 0;

            while (iteration < maxIterations) {
                iteration++;

                // LLM inference
                await this.runStep(ctx, AgentStep.LLM_INFERENCE, async () => {
                    const messages = this.buildMessages(ctx);
                    const result = await this.provider.chat(messages);
                    response = result.content;

                    // Check for tool calls in response
                    ctx.toolCalls = this.parseToolCalls(response);
                });

                // If no tool calls, we're done
                if (ctx.toolCalls.length === 0) {
                    break;
                }

                // Tool execution
                await this.runStep(ctx, AgentStep.TOOL_EXECUTION, async () => {
                    for (const toolCall of ctx.toolCalls) {
                        // Check if allowed
                        if (this.hooks.onToolCall && !this.hooks.onToolCall(ctx, toolCall)) {
                            continue;
                        }

                        const startTime = Date.now();
                        try {
                            const result = await this.toolExecutor?.execute(toolCall.name, toolCall.args);
                            const toolResult: ToolResult = {
                                name: toolCall.name,
                                success: true,
                                result,
                                durationMs: Date.now() - startTime,
                            };
                            ctx.toolResults.push(toolResult);
                            this.hooks.onToolResult?.(ctx, toolResult);
                        } catch (error) {
                            const toolResult: ToolResult = {
                                name: toolCall.name,
                                success: false,
                                error: error instanceof Error ? error.message : String(error),
                                durationMs: Date.now() - startTime,
                            };
                            ctx.toolResults.push(toolResult);
                            this.hooks.onToolResult?.(ctx, toolResult);
                        }
                    }

                    // Clear tool calls for next iteration
                    ctx.toolCalls = [];

                    // Add tool results to history for next LLM call
                    if (ctx.toolResults.length > 0) {
                        const lastResults = ctx.toolResults.slice(-5);
                        const toolOutput = lastResults.map(r =>
                            r.success ? `Tool ${r.name}: ${JSON.stringify(r.result)}` : `Tool ${r.name} error: ${r.error}`
                        ).join("\n");
                        ctx.history?.push({ role: "assistant", content: response });
                        ctx.history?.push({ role: "user", content: `Tool results:\n${toolOutput}\n\nPlease continue.` });
                    }
                });
            }

            // Step 5: Generate reply
            await this.runStep(ctx, AgentStep.GENERATE_REPLY, async () => {
                // Response already generated
            });

            // Step 6: Write session
            await this.runStep(ctx, AgentStep.WRITE_SESSION, async () => {
                // Session write handled by caller
            });

            const durationMs = Date.now() - ctx.startTime;
            this.hooks.onComplete?.(ctx, response);

            return { response, toolResults: ctx.toolResults, durationMs };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.hooks.onError?.(ctx, err);
            throw err;
        }
    }

    private async runStep(
        ctx: AgentLoopContext,
        step: AgentStep,
        fn: () => Promise<void>,
    ): Promise<void> {
        ctx.currentStep = step;
        const stepStart = Date.now();
        this.hooks.onStepStart?.(ctx, step);

        await fn();

        ctx.stepTimes[step] = Date.now() - stepStart;
        this.hooks.onStepComplete?.(ctx, step);
    }

    private buildMessages(ctx: AgentLoopContext): Array<{ role: "system" | "user" | "assistant"; content: string }> {
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

        if (ctx.systemPrompt) {
            messages.push({ role: "system", content: ctx.systemPrompt });
        }

        for (const msg of ctx.history || []) {
            messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
        }

        messages.push({ role: "user", content: ctx.query });

        return messages;
    }

    private parseToolCalls(response: string): ToolCall[] {
        // Simple tool call parsing - look for JSON tool invocations
        const toolCalls: ToolCall[] = [];

        // Pattern: {"tool": "name", "args": {...}}
        const pattern = /\{"tool"\s*:\s*"([^"]+)"\s*,\s*"args"\s*:\s*(\{[^}]+\})\}/g;
        let match;

        while ((match = pattern.exec(response)) !== null) {
            try {
                toolCalls.push({
                    name: match[1],
                    args: JSON.parse(match[2]),
                });
            } catch {
                // Skip invalid JSON
            }
        }

        return toolCalls;
    }
}
