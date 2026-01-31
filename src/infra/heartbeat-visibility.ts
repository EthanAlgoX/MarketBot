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

import type { MarketBotConfig } from "../config/config.js";
import type { ChannelHeartbeatVisibilityConfig } from "../config/types.channels.js";
import type { GatewayMessageChannel } from "../utils/message-channel.js";

export type ResolvedHeartbeatVisibility = {
  showOk: boolean;
  showAlerts: boolean;
  useIndicator: boolean;
};

const DEFAULT_VISIBILITY: ResolvedHeartbeatVisibility = {
  showOk: false, // Silent by default
  showAlerts: true, // Show content messages
  useIndicator: true, // Emit indicator events
};

/**
 * Resolve heartbeat visibility settings for a channel.
 * Supports both deliverable channels (telegram, signal, etc.) and webchat.
 * For webchat, uses channels.defaults.heartbeat since webchat doesn't have per-channel config.
 */
export function resolveHeartbeatVisibility(params: {
  cfg: MarketBotConfig;
  channel: GatewayMessageChannel;
  accountId?: string;
}): ResolvedHeartbeatVisibility {
  const { cfg, channel, accountId } = params;

  // Webchat uses channel defaults only (no per-channel or per-account config)
  if (channel === "webchat") {
    const channelDefaults = cfg.channels?.defaults?.heartbeat;
    return {
      showOk: channelDefaults?.showOk ?? DEFAULT_VISIBILITY.showOk,
      showAlerts: channelDefaults?.showAlerts ?? DEFAULT_VISIBILITY.showAlerts,
      useIndicator: channelDefaults?.useIndicator ?? DEFAULT_VISIBILITY.useIndicator,
    };
  }

  // Layer 1: Global channel defaults
  const channelDefaults = cfg.channels?.defaults?.heartbeat;

  // Layer 2: Per-channel config (at channel root level)
  const channelCfg = cfg.channels?.[channel] as
    | {
        heartbeat?: ChannelHeartbeatVisibilityConfig;
        accounts?: Record<string, { heartbeat?: ChannelHeartbeatVisibilityConfig }>;
      }
    | undefined;
  const perChannel = channelCfg?.heartbeat;

  // Layer 3: Per-account config (most specific)
  const accountCfg = accountId ? channelCfg?.accounts?.[accountId] : undefined;
  const perAccount = accountCfg?.heartbeat;

  // Precedence: per-account > per-channel > channel-defaults > global defaults
  return {
    showOk:
      perAccount?.showOk ??
      perChannel?.showOk ??
      channelDefaults?.showOk ??
      DEFAULT_VISIBILITY.showOk,
    showAlerts:
      perAccount?.showAlerts ??
      perChannel?.showAlerts ??
      channelDefaults?.showAlerts ??
      DEFAULT_VISIBILITY.showAlerts,
    useIndicator:
      perAccount?.useIndicator ??
      perChannel?.useIndicator ??
      channelDefaults?.useIndicator ??
      DEFAULT_VISIBILITY.useIndicator,
  };
}
