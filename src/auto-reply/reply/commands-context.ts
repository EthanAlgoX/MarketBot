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

import type { MarketBotConfig } from "../../config/config.js";
import { resolveCommandAuthorization } from "../command-auth.js";
import { normalizeCommandBody } from "../commands-registry.js";
import type { MsgContext } from "../templating.js";
import type { CommandContext } from "./commands-types.js";
import { stripMentions } from "./mentions.js";

export function buildCommandContext(params: {
  ctx: MsgContext;
  cfg: MarketBotConfig;
  agentId?: string;
  sessionKey?: string;
  isGroup: boolean;
  triggerBodyNormalized: string;
  commandAuthorized: boolean;
}): CommandContext {
  const { ctx, cfg, agentId, sessionKey, isGroup, triggerBodyNormalized } = params;
  const auth = resolveCommandAuthorization({
    ctx,
    cfg,
    commandAuthorized: params.commandAuthorized,
  });
  const surface = (ctx.Surface ?? ctx.Provider ?? "").trim().toLowerCase();
  const channel = (ctx.Provider ?? surface).trim().toLowerCase();
  const abortKey = sessionKey ?? (auth.from || undefined) ?? (auth.to || undefined);
  const rawBodyNormalized = triggerBodyNormalized;
  const commandBodyNormalized = normalizeCommandBody(
    isGroup ? stripMentions(rawBodyNormalized, ctx, cfg, agentId) : rawBodyNormalized,
  );

  return {
    surface,
    channel,
    channelId: auth.providerId,
    ownerList: auth.ownerList,
    isAuthorizedSender: auth.isAuthorizedSender,
    senderId: auth.senderId,
    abortKey,
    rawBodyNormalized,
    commandBodyNormalized,
    from: auth.from,
    to: auth.to,
  };
}
