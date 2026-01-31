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

import type { MarketBotConfig, HumanDelayConfig, IdentityConfig } from "../config/config.js";
import { resolveAgentConfig } from "./agent-scope.js";

const DEFAULT_ACK_REACTION = "👀";

export function resolveAgentIdentity(
  cfg: MarketBotConfig,
  agentId: string,
): IdentityConfig | undefined {
  return resolveAgentConfig(cfg, agentId)?.identity;
}

export function resolveAckReaction(cfg: MarketBotConfig, agentId: string): string {
  const configured = cfg.messages?.ackReaction;
  if (configured !== undefined) {
    return configured.trim();
  }
  const emoji = resolveAgentIdentity(cfg, agentId)?.emoji?.trim();
  return emoji || DEFAULT_ACK_REACTION;
}

export function resolveIdentityNamePrefix(
  cfg: MarketBotConfig,
  agentId: string,
): string | undefined {
  const name = resolveAgentIdentity(cfg, agentId)?.name?.trim();
  if (!name) {
    return undefined;
  }
  return `[${name}]`;
}

/** Returns just the identity name (without brackets) for template context. */
export function resolveIdentityName(cfg: MarketBotConfig, agentId: string): string | undefined {
  return resolveAgentIdentity(cfg, agentId)?.name?.trim() || undefined;
}

export function resolveMessagePrefix(
  cfg: MarketBotConfig,
  agentId: string,
  opts?: { configured?: string; hasAllowFrom?: boolean; fallback?: string },
): string {
  const configured = opts?.configured ?? cfg.messages?.messagePrefix;
  if (configured !== undefined) {
    return configured;
  }

  const hasAllowFrom = opts?.hasAllowFrom === true;
  if (hasAllowFrom) {
    return "";
  }

  return resolveIdentityNamePrefix(cfg, agentId) ?? opts?.fallback ?? "[marketbot]";
}

export function resolveResponsePrefix(cfg: MarketBotConfig, agentId: string): string | undefined {
  const configured = cfg.messages?.responsePrefix;
  if (configured !== undefined) {
    if (configured === "auto") {
      return resolveIdentityNamePrefix(cfg, agentId);
    }
    return configured;
  }
  return undefined;
}

export function resolveEffectiveMessagesConfig(
  cfg: MarketBotConfig,
  agentId: string,
  opts?: { hasAllowFrom?: boolean; fallbackMessagePrefix?: string },
): { messagePrefix: string; responsePrefix?: string } {
  return {
    messagePrefix: resolveMessagePrefix(cfg, agentId, {
      hasAllowFrom: opts?.hasAllowFrom,
      fallback: opts?.fallbackMessagePrefix,
    }),
    responsePrefix: resolveResponsePrefix(cfg, agentId),
  };
}

export function resolveHumanDelayConfig(
  cfg: MarketBotConfig,
  agentId: string,
): HumanDelayConfig | undefined {
  const defaults = cfg.agents?.defaults?.humanDelay;
  const overrides = resolveAgentConfig(cfg, agentId)?.humanDelay;
  if (!defaults && !overrides) {
    return undefined;
  }
  return {
    mode: overrides?.mode ?? defaults?.mode,
    minMs: overrides?.minMs ?? defaults?.minMs,
    maxMs: overrides?.maxMs ?? defaults?.maxMs,
  };
}
