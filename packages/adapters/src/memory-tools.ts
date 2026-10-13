// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import type { ConnectorTool } from "@marketbot/adapter-kit";

const SEMANTIC_MEMORY_TOOL_NAMES = new Set(["recall_memory", "save_memory", "forget_memory"]);

export function selectMemoryTools(
  tools: ConnectorTool[],
  semanticMemoryConfigured: boolean,
): ConnectorTool[] {
  return semanticMemoryConfigured
    ? tools.filter((tool) => tool.name !== "remember")
    : tools.filter((tool) => !SEMANTIC_MEMORY_TOOL_NAMES.has(tool.name));
}
