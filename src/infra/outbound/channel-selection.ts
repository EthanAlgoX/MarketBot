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

import { listChannelPlugins } from "../../channels/plugins/index.js";
import type { ChannelPlugin } from "../../channels/plugins/types.js";
import type { MarketBotConfig } from "../../config/config.js";
import {
  listDeliverableMessageChannels,
  type DeliverableMessageChannel,
  normalizeMessageChannel,
} from "../../utils/message-channel.js";

export type MessageChannelId = DeliverableMessageChannel;

const getMessageChannels = () => listDeliverableMessageChannels();

function isKnownChannel(value: string): boolean {
  return getMessageChannels().includes(value as MessageChannelId);
}

function isAccountEnabled(account: unknown): boolean {
  if (!account || typeof account !== "object") {
    return true;
  }
  const enabled = (account as { enabled?: boolean }).enabled;
  return enabled !== false;
}

async function isPluginConfigured(plugin: ChannelPlugin, cfg: MarketBotConfig): Promise<boolean> {
  const accountIds = plugin.config.listAccountIds(cfg);
  if (accountIds.length === 0) {
    return false;
  }

  for (const accountId of accountIds) {
    const account = plugin.config.resolveAccount(cfg, accountId);
    const enabled = plugin.config.isEnabled
      ? plugin.config.isEnabled(account, cfg)
      : isAccountEnabled(account);
    if (!enabled) {
      continue;
    }
    if (!plugin.config.isConfigured) {
      return true;
    }
    const configured = await plugin.config.isConfigured(account, cfg);
    if (configured) {
      return true;
    }
  }

  return false;
}

export async function listConfiguredMessageChannels(
  cfg: MarketBotConfig,
): Promise<MessageChannelId[]> {
  const channels: MessageChannelId[] = [];
  for (const plugin of listChannelPlugins()) {
    if (!isKnownChannel(plugin.id)) {
      continue;
    }
    if (await isPluginConfigured(plugin, cfg)) {
      channels.push(plugin.id);
    }
  }
  return channels;
}

export async function resolveMessageChannelSelection(params: {
  cfg: MarketBotConfig;
  channel?: string | null;
}): Promise<{ channel: MessageChannelId; configured: MessageChannelId[] }> {
  const normalized = normalizeMessageChannel(params.channel);
  if (normalized) {
    if (!isKnownChannel(normalized)) {
      throw new Error(`Unknown channel: ${String(normalized)}`);
    }
    return {
      channel: normalized as MessageChannelId,
      configured: await listConfiguredMessageChannels(params.cfg),
    };
  }

  const configured = await listConfiguredMessageChannels(params.cfg);
  if (configured.length === 1) {
    return { channel: configured[0], configured };
  }
  if (configured.length === 0) {
    throw new Error("Channel is required (no configured channels detected).");
  }
  throw new Error(
    `Channel is required when multiple channels are configured: ${configured.join(", ")}`,
  );
}
