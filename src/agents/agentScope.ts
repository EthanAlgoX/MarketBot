import path from "node:path";

import type { MarketBotConfig } from "../config/types.js";
import { resolveConfigPath, resolveWorkspaceRoot } from "../config/paths.js";

export interface AgentEntry {
  id: string;
  name?: string;
  workspace?: string;
  default?: boolean;
  tools?: MarketBotConfig["tools"];
}

export function normalizeAgentId(id?: string): string {
  return (id ?? "main").trim().toLowerCase();
}

function listAgents(cfg: MarketBotConfig): AgentEntry[] {
  const list = cfg.agents?.list;
  if (!Array.isArray(list)) return [];
  return list.filter((entry): entry is AgentEntry => Boolean(entry && typeof entry.id === "string"));
}

export function listAgentIds(cfg: MarketBotConfig): string[] {
  const agents = listAgents(cfg);
  if (agents.length === 0) return ["main"];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of agents) {
    const id = normalizeAgentId(entry.id);
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids.length > 0 ? ids : ["main"];
}

export function resolveDefaultAgentId(cfg: MarketBotConfig): string {
  const agents = listAgents(cfg);
  if (agents.length === 0) return "main";
  const defaults = agents.filter((entry) => entry.default);
  const chosen = (defaults[0] ?? agents[0])?.id;
  return normalizeAgentId(chosen);
}

export function resolveAgentConfig(cfg: MarketBotConfig, agentId: string): AgentEntry | undefined {
  const id = normalizeAgentId(agentId);
  return listAgents(cfg).find((entry) => normalizeAgentId(entry.id) === id);
}

export function resolveAgentWorkspaceDir(
  cfg: MarketBotConfig,
  agentId: string,
  cwd: string = process.cwd(),
): string {
  const id = normalizeAgentId(agentId);
  const entry = resolveAgentConfig(cfg, id);
  if (entry?.workspace?.trim()) return entry.workspace.trim();

  const defaultId = resolveDefaultAgentId(cfg);
  const envOverride = process.env.MARKETBOT_WORKSPACE_DIR?.trim() ?? process.env.TRADEBOT_WORKSPACE_DIR?.trim();
  if (envOverride && id === defaultId) return envOverride;

  const configPath = resolveConfigPath(cwd);
  const root = resolveWorkspaceRoot(configPath);
  const defaultWorkspace = cfg.agents?.defaults?.workspace?.trim() || root;

  if (id === defaultId) return defaultWorkspace;
  return path.join(root, id);
}
