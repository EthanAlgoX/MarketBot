/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 *
 * MarketBot is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * MarketBot is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with MarketBot.  If not, see <https://www.gnu.org/licenses/>.
 */

import { getChannelDock } from "../channels/dock.js";
import { getChannelPlugin, listChannelPlugins } from "../channels/plugins/index.js";
import { normalizeAnyChannelId } from "../channels/registry.js";
import type {
  ChannelAgentTool,
  ChannelMessageActionName,
  ChannelPlugin,
} from "../channels/plugins/types.js";
import type { MarketBotConfig } from "../config/config.js";
import { defaultRuntime } from "../runtime.js";

/**
 * Get the list of supported message actions for a specific channel.
 * Returns an empty array if channel is not found or has no actions configured.
 */
export function listChannelSupportedActions(params: {
  cfg?: MarketBotConfig;
  channel?: string;
}): ChannelMessageActionName[] {
  if (!params.channel) {
    return [];
  }
  const plugin = getChannelPlugin(params.channel as Parameters<typeof getChannelPlugin>[0]);
  if (!plugin?.actions?.listActions) {
    return [];
  }
  const cfg = params.cfg ?? ({} as MarketBotConfig);
  return runPluginListActions(plugin, cfg);
}

/**
 * Get the list of all supported message actions across all configured channels.
 */
export function listAllChannelSupportedActions(params: {
  cfg?: MarketBotConfig;
}): ChannelMessageActionName[] {
  const actions = new Set<ChannelMessageActionName>();
  for (const plugin of listChannelPlugins()) {
    if (!plugin.actions?.listActions) {
      continue;
    }
    const cfg = params.cfg ?? ({} as MarketBotConfig);
    const channelActions = runPluginListActions(plugin, cfg);
    for (const action of channelActions) {
      actions.add(action);
    }
  }
  return Array.from(actions);
}

export function listChannelAgentTools(params: { cfg?: MarketBotConfig }): ChannelAgentTool[] {
  // Channel docking: aggregate channel-owned tools (login, etc.).
  const tools: ChannelAgentTool[] = [];
  for (const plugin of listChannelPlugins()) {
    const entry = plugin.agentTools;
    if (!entry) {
      continue;
    }
    const resolved = typeof entry === "function" ? entry(params) : entry;
    if (Array.isArray(resolved)) {
      tools.push(...resolved);
    }
  }
  return tools;
}

export function resolveChannelMessageToolHints(params: {
  cfg?: MarketBotConfig;
  channel?: string | null;
  accountId?: string | null;
}): string[] {
  const channelId = normalizeAnyChannelId(params.channel);
  if (!channelId) {
    return [];
  }
  const dock = getChannelDock(channelId);
  const resolve = dock?.agentPrompt?.messageToolHints;
  if (!resolve) {
    return [];
  }
  const cfg = params.cfg ?? ({} as MarketBotConfig);
  return (resolve({ cfg, accountId: params.accountId }) ?? [])
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const loggedListActionErrors = new Set<string>();

function runPluginListActions(
  plugin: ChannelPlugin,
  cfg: MarketBotConfig,
): ChannelMessageActionName[] {
  if (!plugin.actions?.listActions) {
    return [];
  }
  try {
    const listed = plugin.actions.listActions({ cfg });
    return Array.isArray(listed) ? listed : [];
  } catch (err) {
    logListActionsError(plugin.id, err);
    return [];
  }
}

function logListActionsError(pluginId: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const key = `${pluginId}:${message}`;
  if (loggedListActionErrors.has(key)) {
    return;
  }
  loggedListActionErrors.add(key);
  const stack = err instanceof Error && err.stack ? err.stack : null;
  const details = stack ?? message;
  defaultRuntime.error?.(`[channel-tools] ${pluginId}.actions.listActions failed: ${details}`);
}

export const __testing = {
  resetLoggedListActionErrors() {
    loggedListActionErrors.clear();
  },
};
