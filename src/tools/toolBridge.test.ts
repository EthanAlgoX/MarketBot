import { describe, expect, it, vi } from "vitest";
import { createToolBridge, convertToolSpecToDefinition, createToolRunner } from "./toolBridge.js";
import type { ToolSpec } from "./types.js";

describe("toolBridge", () => {
    const mockTools: ToolSpec[] = [
        {
            name: "test_tool",
            description: "A test tool",
            run: async (ctx) => ({ ok: true, output: `Ran with ${ctx.rawArgs}` }),
        },
        {
            name: "json_tool",
            run: async (ctx) => ({ ok: true, output: `JSON: ${JSON.stringify(ctx.json)}` }),
        },
    ];

    it("convertToolSpecToDefinition creates correct OpenAI schema", () => {
        const def = convertToolSpecToDefinition(mockTools[0]);
        expect(def.type).toBe("function");
        expect(def.function.name).toBe("test_tool");
        expect(def.function.description).toBe("A test tool");
        expect(def.function.parameters.type).toBe("object");
    });

    it("createToolRunner should execute the correct tool", async () => {
        const runner = createToolRunner(mockTools);

        const result = await runner({
            id: "call_1",
            name: "test_tool",
            arguments: "hello world",
        });

        expect(result.ok).toBe(true);
        expect(result.name).toBe("test_tool");
        expect(result.output).toBe("Ran with hello world");
    });

    it("createToolRunner should handle JSON arguments", async () => {
        const runner = createToolRunner(mockTools);

        const result = await runner({
            id: "call_2",
            name: "json_tool",
            arguments: '{"key": "value"}',
        });

        expect(result.ok).toBe(true);
        // The tool implementation stringifies the input
        expect(result.output).toContain('{"key":"value"}');
    });

    it("createToolRunner should return error for unknown tool", async () => {
        const runner = createToolRunner(mockTools);

        const result = await runner({
            id: "call_3",
            name: "unknown_tool",
            arguments: "{}",
        });

        expect(result.ok).toBe(false);
        expect(result.output).toContain("Tool not found");
    });

    it("createToolBridge returns both definitions and runner", () => {
        const bridge = createToolBridge(mockTools);
        expect(bridge.definitions).toHaveLength(2);
        expect(typeof bridge.runner).toBe("function");
    });
});
