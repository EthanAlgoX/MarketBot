// Modified for marketbot on 2026-10-13; see MODIFICATIONS.md.
import type { ConnectorTool } from "@marketbot/adapter-kit";

export const CLOUD_AGENT_TOOL_NAMES = new Set([
  "cloud_agent_launch",
  "cloud_agent_status",
  "cloud_agent_reply",
  "cloud_agent_cancel",
]);

/** Drop cloud-agent tools when no provider is configured. */
export function selectCloudAgentTools(
  tools: ConnectorTool[],
  cloudAgentConfigured: boolean,
): ConnectorTool[] {
  return cloudAgentConfigured
    ? tools
    : tools.filter((tool) => !CLOUD_AGENT_TOOL_NAMES.has(tool.name));
}
