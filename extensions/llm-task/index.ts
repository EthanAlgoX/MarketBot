import type { MarketBotPluginApi } from "../../src/plugins/types.js";

import { createLlmTaskTool } from "./src/llm-task-tool.js";

export default function register(api: MarketBotPluginApi) {
  api.registerTool(createLlmTaskTool(api), { optional: true });
}
