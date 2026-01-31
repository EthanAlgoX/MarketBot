import { describe, expect, it, vi } from "vitest";
import { runAgentLoop, type AgentLoopOptions } from "./agentLoop.js";
import type { LLMProvider, LLMMessage, LLMResponse } from "./llm.js";
import type { LLMToolResponse, ToolDefinition, ToolCall, ToolCallResult } from "./agentTypes.js";

// Mock LLM Provider
class MockAgenticProvider implements LLMProvider {
    messages: LLMMessage[] = [];
    tools: ToolDefinition[] = [];

    constructor(private responses: Array<LLMToolResponse>) { }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        throw new Error("Parameters not supported in mock");
    }

    async complete(prompt: string): Promise<string> {
        throw new Error("Method not implemented.");
    }

    async chatWithTools(messages: LLMMessage[], tools: ToolDefinition[]): Promise<LLMToolResponse> {
        this.messages = messages;
        this.tools = tools;
        const response = this.responses.shift();
        if (!response) {
            throw new Error("No more mock responses");
        }
        return response;
    }
}

describe("runAgentLoop", () => {
    it("should run a simple query without tool calls", async () => {
        const provider = new MockAgenticProvider([
            {
                content: "Hello! How can I help you?",
                finishReason: "stop",
                usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
            },
        ]);

        const result = await runAgentLoop({
            provider,
            tools: [],
            toolRunner: async () => ({ callId: "1", name: "test", ok: true, output: "" }),
            systemPrompt: "You are a helper.",
            userQuery: "Hi",
        });

        expect(result.completed).toBe(true);
        expect(result.finalResponse).toBe("Hello! How can I help you?");
        expect(result.iterations).toBe(1);
        expect(result.toolCalls).toHaveLength(0);
    });

    it("should execute tool calls and return results to LLM", async () => {
        const provider = new MockAgenticProvider([
            // First response: call a tool
            {
                content: null,
                toolCalls: [
                    {
                        id: "call_1",
                        name: "get_weather",
                        arguments: '{"city": "Tokyo"}',
                    },
                ],
                finishReason: "tool_calls",
            },
            // Second response: final answer after tool
            {
                content: "The weather in Tokyo is sunny.",
                finishReason: "stop",
            },
        ]);

        const toolRunner = vi.fn().mockResolvedValue({
            callId: "call_1",
            name: "get_weather",
            ok: true,
            output: "Sunny, 25C",
        });

        const result = await runAgentLoop({
            provider,
            tools: [{ type: "function", function: { name: "get_weather", parameters: { type: "object", properties: {} } } }],
            toolRunner,
            systemPrompt: "System",
            userQuery: "Weather?",
        });

        expect(result.completed).toBe(true);
        expect(result.finalResponse).toBe("The weather in Tokyo is sunny.");
        expect(result.iterations).toBe(2);
        expect(result.toolCalls).toHaveLength(1);
        expect(toolRunner).toHaveBeenCalledWith({
            id: "call_1",
            name: "get_weather",
            arguments: '{"city": "Tokyo"}',
        });

        // Verify conversation history structure
        expect(result.messages).toHaveLength(5); // System, User, Assistant(ToolCall), Tool, Assistant(Final)
        expect(result.messages[2].role).toBe("assistant");
        expect(result.messages[3].role).toBe("tool");
        expect(result.messages[3].content).toBe("Sunny, 25C");
    });

    it("should handle max iterations", async () => {
        // Infinite loop of tool calls
        const responses: LLMToolResponse[] = Array(5).fill({
            content: null,
            toolCalls: [{ id: "call_x", name: "loop", arguments: "{}" }],
            finishReason: "tool_calls",
        });

        const provider = new MockAgenticProvider(responses);

        const result = await runAgentLoop({
            provider,
            tools: [],
            toolRunner: async (call) => ({ callId: call.id, name: call.name, ok: true, output: "done" }),
            systemPrompt: "System",
            userQuery: "Loop",
            config: { maxIterations: 3 },
        });

        expect(result.completed).toBe(false);
        expect(result.iterations).toBe(3);
        expect(result.error).toContain("Max iterations (3) reached");
    });
});
