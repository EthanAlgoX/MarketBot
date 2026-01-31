import type { ToolSpec, ToolContext } from "../../tools/types.js";

export const echoTool: ToolSpec = {
    name: "echo",
    description: "Echo raw arguments",
    version: "1.0.0",
    tags: ["util"],
    inputSchema: {
        type: "object",
        properties: {
            input: { type: "string", description: "Raw input to echo back" },
        },
    },
    run: async (context: ToolContext) => ({
        ok: true,
        output: context.rawArgs,
    }),
};

export default [echoTool];
