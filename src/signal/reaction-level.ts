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
import { resolveSignalAccount } from "./accounts.js";

export type SignalReactionLevel = "off" | "ack" | "minimal" | "extensive";

export type ResolvedSignalReactionLevel = {
  level: SignalReactionLevel;
  /** Whether ACK reactions (e.g., 👀 when processing) are enabled. */
  ackEnabled: boolean;
  /** Whether agent-controlled reactions are enabled. */
  agentReactionsEnabled: boolean;
  /** Guidance level for agent reactions (minimal = sparse, extensive = liberal). */
  agentReactionGuidance?: "minimal" | "extensive";
};

/**
 * Resolve the effective reaction level and its implications for Signal.
 *
 * Levels:
 * - "off": No reactions at all
 * - "ack": Only automatic ack reactions (👀 when processing), no agent reactions
 * - "minimal": Agent can react, but sparingly (default)
 * - "extensive": Agent can react liberally
 */
export function resolveSignalReactionLevel(params: {
  cfg: MarketBotConfig;
  accountId?: string;
}): ResolvedSignalReactionLevel {
  const account = resolveSignalAccount({
    cfg: params.cfg,
    accountId: params.accountId,
  });
  const level = (account.config.reactionLevel ?? "minimal") as SignalReactionLevel;

  switch (level) {
    case "off":
      return {
        level,
        ackEnabled: false,
        agentReactionsEnabled: false,
      };
    case "ack":
      return {
        level,
        ackEnabled: true,
        agentReactionsEnabled: false,
      };
    case "minimal":
      return {
        level,
        ackEnabled: false,
        agentReactionsEnabled: true,
        agentReactionGuidance: "minimal",
      };
    case "extensive":
      return {
        level,
        ackEnabled: false,
        agentReactionsEnabled: true,
        agentReactionGuidance: "extensive",
      };
    default:
      // Fallback to minimal behavior
      return {
        level: "minimal",
        ackEnabled: false,
        agentReactionsEnabled: true,
        agentReactionGuidance: "minimal",
      };
  }
}
