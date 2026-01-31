// Agent Types for LLM Tool Calling
// Defines types for the agentic loop where LLM can autonomously call tools

/**
 * OpenAI-compatible tool definition for LLM function calling
 */
export interface ToolDefinition {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters: {
            type: "object";
            properties: Record<string, ToolParameterSchema>;
            required?: string[];
        };
    };
}

export interface ToolParameterSchema {
    type: "string" | "number" | "boolean" | "array" | "object";
    description?: string;
    enum?: string[];
    items?: ToolParameterSchema;
    properties?: Record<string, ToolParameterSchema>;
}

/**
 * Tool call parsed from LLM response
 */
export interface ToolCall {
    id: string;
    name: string;
    arguments: string; // JSON string
}

/**
 * Result of executing a tool
 */
export interface ToolCallResult {
    callId: string;
    name: string;
    ok: boolean;
    output: string;
    data?: unknown;
}

/**
 * Message in the agent conversation
 */
export type AgentMessage =
    | { role: "system"; content: string }
    | { role: "user"; content: string }
    | { role: "assistant"; content: string | null; toolCalls?: ToolCall[] }
    | { role: "tool"; toolCallId: string; content: string };

/**
 * Configuration for the agent loop
 */
export interface AgentLoopConfig {
    /** Maximum number of LLM ↔ tool iterations (default: 10) */
    maxIterations?: number;
    /** Timeout in milliseconds for the entire loop */
    timeoutMs?: number;
    /** Abort signal for cancellation */
    abortSignal?: AbortSignal;
    /** Callback for each tool execution */
    onToolCall?: (call: ToolCall, result: ToolCallResult) => void;
    /** Callback for each LLM response */
    onAssistantMessage?: (content: string | null, toolCalls?: ToolCall[]) => void;
}

/**
 * Result of running the agent loop
 */
export interface AgentLoopResult {
    /** Final text response from the LLM */
    finalResponse: string;
    /** Full conversation history */
    messages: AgentMessage[];
    /** Number of iterations completed */
    iterations: number;
    /** Whether the loop completed normally */
    completed: boolean;
    /** Error message if the loop failed */
    error?: string;
    /** All tool calls made during the loop */
    toolCalls: ToolCallResult[];
}

/**
 * LLM response with tool calling support
 */
export interface LLMToolResponse {
    content: string | null;
    toolCalls?: ToolCall[];
    finishReason?: "stop" | "tool_calls" | "length" | "content_filter";
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
