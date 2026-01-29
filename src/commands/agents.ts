import path from "node:path";

import { loadConfig, writeConfig } from "../config/io.js";
import type { MarketBotConfig } from "../config/types.js";
import { resolveConfigPath, resolveWorkspaceRoot } from "../config/paths.js";
import { ensureWorkspace } from "../agents/workspace.js";
import { listAgentIds, normalizeAgentId, resolveAgentConfig, resolveDefaultAgentId } from "../agents/agentScope.js";

export async function agentsListCommand(opts: { json?: boolean } = {}): Promise<void> {
  const config = await loadConfig();
  const ids = listAgentIds(config);
  const defaultId = resolveDefaultAgentId(config);

  if (opts.json) {
    const entries = ids.map((id) => ({
      id,
      default: id === defaultId,
      name: resolveAgentConfig(config, id)?.name,
      workspace: resolveAgentConfig(config, id)?.workspace,
    }));
    console.log(JSON.stringify({ agents: entries }, null, 2));
    return;
  }

  for (const id of ids) {
    const entry = resolveAgentConfig(config, id);
    const name = entry?.name ? ` (${entry.name})` : "";
    const marker = id === defaultId ? "*" : " ";
    console.log(`${marker} ${id}${name}`);
  }
}

export async function agentsAddCommand(params: {
  id: string;
  name?: string;
  workspace?: string;
  makeDefault?: boolean;
  json?: boolean;
}): Promise<void> {
  const config = await loadConfig();
  const normalized = normalizeAgentId(params.id);
  const configPath = resolveConfigPath();
  const workspaceRoot = resolveWorkspaceRoot(configPath);

  if (!config.agents) config.agents = {};
  if (!config.agents.defaults) {
    config.agents.defaults = { ensureBootstrap: true };
  }
  if (!Array.isArray(config.agents.list)) config.agents.list = [];

  if (config.agents.list.some((entry) => normalizeAgentId(entry.id) === normalized)) {
    throw new Error(`Agent already exists: ${normalized}`);
  }

  const workspace = params.workspace?.trim() || path.join(workspaceRoot, normalized);

  if (params.makeDefault) {
    config.agents.list = config.agents.list.map((entry) => ({ ...entry, default: false }));
  }

  config.agents.list.push({
    id: normalized,
    name: params.name?.trim(),
    workspace,
    default: params.makeDefault || config.agents.list.length === 0,
  });

  await writeConfig(config as MarketBotConfig);
  await ensureWorkspace(config, normalized);

  if (params.json) {
    console.log(JSON.stringify({ id: normalized, name: params.name, workspace }, null, 2));
    return;
  }

  console.log(`Added agent ${normalized}`);
  console.log(`Workspace: ${workspace}`);
}
