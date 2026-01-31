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

import { normalizeChannelId } from "../channels/plugins/index.js";
import { normalizeAccountId } from "../routing/session-key.js";
import type { MarketBotConfig } from "./config.js";
import type { TelegramCapabilitiesConfig } from "./types.telegram.js";

type CapabilitiesConfig = TelegramCapabilitiesConfig;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

function normalizeCapabilities(capabilities: CapabilitiesConfig | undefined): string[] | undefined {
  // Handle object-format capabilities (e.g., { inlineButtons: "dm" }) gracefully.
  // Channel-specific handlers (like resolveTelegramInlineButtonsScope) process these separately.
  if (!isStringArray(capabilities)) {
    return undefined;
  }
  const normalized = capabilities.map((entry) => entry.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}

function resolveAccountCapabilities(params: {
  cfg?: { accounts?: Record<string, { capabilities?: CapabilitiesConfig }> } & {
    capabilities?: CapabilitiesConfig;
  };
  accountId?: string | null;
}): string[] | undefined {
  const cfg = params.cfg;
  if (!cfg) {
    return undefined;
  }
  const normalizedAccountId = normalizeAccountId(params.accountId);

  const accounts = cfg.accounts;
  if (accounts && typeof accounts === "object") {
    const direct = accounts[normalizedAccountId];
    if (direct) {
      return normalizeCapabilities(direct.capabilities) ?? normalizeCapabilities(cfg.capabilities);
    }
    const matchKey = Object.keys(accounts).find(
      (key) => key.toLowerCase() === normalizedAccountId.toLowerCase(),
    );
    const match = matchKey ? accounts[matchKey] : undefined;
    if (match) {
      return normalizeCapabilities(match.capabilities) ?? normalizeCapabilities(cfg.capabilities);
    }
  }

  return normalizeCapabilities(cfg.capabilities);
}

export function resolveChannelCapabilities(params: {
  cfg?: Partial<MarketBotConfig>;
  channel?: string | null;
  accountId?: string | null;
}): string[] | undefined {
  const cfg = params.cfg;
  const channel = normalizeChannelId(params.channel);
  if (!cfg || !channel) {
    return undefined;
  }

  const channelsConfig = cfg.channels as Record<string, unknown> | undefined;
  const channelConfig = (channelsConfig?.[channel] ?? (cfg as Record<string, unknown>)[channel]) as
    | {
        accounts?: Record<string, { capabilities?: CapabilitiesConfig }>;
        capabilities?: CapabilitiesConfig;
      }
    | undefined;
  return resolveAccountCapabilities({
    cfg: channelConfig,
    accountId: params.accountId,
  });
}
