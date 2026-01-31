import type { ToolSpec, ToolContext } from "./types.js";
import { fetchWithTimeout } from "../data/providers/providerUtils.js";
import { createMarketBotTools } from "./marketbot.js";

export function createBuiltinTools(): ToolSpec[] {
  return [echoTool(), httpGetTool(), ...createMarketBotTools()];
}

function echoTool(): ToolSpec {
  return {
    name: "echo",
    description: "Echo raw arguments",
    run: async (context: ToolContext) => ({
      ok: true,
      output: context.rawArgs,
    }),
  };
}

function httpGetTool(): ToolSpec {
  return {
    name: "http_get",
    description: "Fetch a URL and return the first 4000 chars",
    run: async (context: ToolContext) => {
      const url = context.rawArgs.trim();
      if (!url) {
        return { ok: false, output: "Missing URL" };
      }
      const response = await fetchWithTimeout(url, { timeout: 10_000 });
      const text = await response.text();
      const output = text.slice(0, 4000);
      return { ok: response.ok, output, data: { status: response.status } };
    },
  };
}
