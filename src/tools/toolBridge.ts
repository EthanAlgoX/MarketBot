// Tool Bridge: Connect ToolRegistry with LLM tool calling
// Converts ToolSpec to ToolDefinition and creates a tool runner

import type { ToolSpec, ToolContext, ToolResult } from "./types.js";
import type { ToolDefinition, ToolCall, ToolCallResult } from "../core/agentTypes.js";
import { appendToolLog } from "./toolLogging.js";

/**
 * Convert a ToolSpec to an OpenAI-compatible ToolDefinition
 */
export function convertToolSpecToDefinition(tool: ToolSpec): ToolDefinition {
    const parameters = tool.inputSchema ?? {
        type: "object",
        properties: {
            input: {
                type: "object",
                description: "JSON input for the tool",
            },
        },
        required: [],
    };

    return {
        type: "function",
        function: {
            name: tool.name,
            description: tool.description ?? `Execute the ${tool.name} tool`,
            parameters,
        },
    };
}

/**
 * Create tool definitions from a list of ToolSpecs
 */
export function createToolDefinitions(tools: ToolSpec[]): ToolDefinition[] {
    return tools.map(convertToolSpecToDefinition);
}

/**
 * Create a tool runner function that executes tools by name
 */
export function createToolRunner(
    tools: ToolSpec[],
    baseContext?: Partial<ToolContext>
): (call: ToolCall) => Promise<ToolCallResult> {
    const toolMap = new Map(tools.map(t => [t.name, t]));

    return async (call: ToolCall): Promise<ToolCallResult> => {
        const tool = toolMap.get(call.name);
        if (!tool) {
            return {
                callId: call.id,
                name: call.name,
                ok: false,
                output: `Tool not found: ${call.name}`,
            };
        }

        // Parse arguments
        let parsedArgs: Record<string, unknown> = {};
        try {
            parsedArgs = JSON.parse(call.arguments);
        } catch {
            // If not valid JSON, treat as raw string
            parsedArgs = { rawInput: call.arguments };
        }

        // Build tool context
        const context: ToolContext = {
            rawArgs: call.arguments,
            args: Object.values(parsedArgs).map(v => String(v)),
            json: parsedArgs.input ?? parsedArgs,
            cwd: baseContext?.cwd ?? process.cwd(),
            env: baseContext?.env ?? process.env,
        };

        const startedAt = Date.now();
        let result: ToolResult;
        try {
            result = await tool.run(context);
        } catch (err) {
            const durationMs = Date.now() - startedAt;
            await appendToolLog({
                name: call.name,
                ok: false,
                durationMs,
                input: call.arguments,
                error: err instanceof Error ? err.message : String(err),
            }, context);
            return {
                callId: call.id,
                name: call.name,
                ok: false,
                output: `Tool execution error: ${err instanceof Error ? err.message : String(err)}`,
            };
        }

        const durationMs = Date.now() - startedAt;
        await appendToolLog({
            name: call.name,
            ok: result.ok,
            durationMs,
            input: call.arguments,
            output: result.output,
        }, context);

        return {
            callId: call.id,
            name: call.name,
            ok: result.ok,
            output: result.output,
            data: result.data,
        };
    };
}

/**
 * Create a complete tool bridge for use with the agent loop
 */
export function createToolBridge(
    tools: ToolSpec[],
    baseContext?: Partial<ToolContext>
): {
    definitions: ToolDefinition[];
    runner: (call: ToolCall) => Promise<ToolCallResult>;
} {
    return {
        definitions: createToolDefinitions(tools),
        runner: createToolRunner(tools, baseContext),
    };
}
