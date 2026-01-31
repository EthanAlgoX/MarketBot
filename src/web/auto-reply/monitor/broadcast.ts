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

import type { loadConfig } from "../../../config/config.js";
import type { resolveAgentRoute } from "../../../routing/resolve-route.js";
import { buildAgentSessionKey } from "../../../routing/resolve-route.js";
import {
  buildAgentMainSessionKey,
  DEFAULT_MAIN_KEY,
  normalizeAgentId,
} from "../../../routing/session-key.js";
import { formatError } from "../../session.js";
import { whatsappInboundLog } from "../loggers.js";
import type { WebInboundMsg } from "../types.js";
import type { GroupHistoryEntry } from "./process-message.js";

export async function maybeBroadcastMessage(params: {
  cfg: ReturnType<typeof loadConfig>;
  msg: WebInboundMsg;
  peerId: string;
  route: ReturnType<typeof resolveAgentRoute>;
  groupHistoryKey: string;
  groupHistories: Map<string, GroupHistoryEntry[]>;
  processMessage: (
    msg: WebInboundMsg,
    route: ReturnType<typeof resolveAgentRoute>,
    groupHistoryKey: string,
    opts?: {
      groupHistory?: GroupHistoryEntry[];
      suppressGroupHistoryClear?: boolean;
    },
  ) => Promise<boolean>;
}) {
  const broadcastAgents = params.cfg.broadcast?.[params.peerId];
  if (!broadcastAgents || !Array.isArray(broadcastAgents)) {
    return false;
  }
  if (broadcastAgents.length === 0) {
    return false;
  }

  const strategy = params.cfg.broadcast?.strategy || "parallel";
  whatsappInboundLog.info(`Broadcasting message to ${broadcastAgents.length} agents (${strategy})`);

  const agentIds = params.cfg.agents?.list?.map((agent) => normalizeAgentId(agent.id));
  const hasKnownAgents = (agentIds?.length ?? 0) > 0;
  const groupHistorySnapshot =
    params.msg.chatType === "group"
      ? (params.groupHistories.get(params.groupHistoryKey) ?? [])
      : undefined;

  const processForAgent = async (agentId: string): Promise<boolean> => {
    const normalizedAgentId = normalizeAgentId(agentId);
    if (hasKnownAgents && !agentIds?.includes(normalizedAgentId)) {
      whatsappInboundLog.warn(`Broadcast agent ${agentId} not found in agents.list; skipping`);
      return false;
    }
    const agentRoute = {
      ...params.route,
      agentId: normalizedAgentId,
      sessionKey: buildAgentSessionKey({
        agentId: normalizedAgentId,
        channel: "whatsapp",
        accountId: params.route.accountId,
        peer: {
          kind: params.msg.chatType === "group" ? "group" : "dm",
          id: params.peerId,
        },
        dmScope: params.cfg.session?.dmScope,
        identityLinks: params.cfg.session?.identityLinks,
      }),
      mainSessionKey: buildAgentMainSessionKey({
        agentId: normalizedAgentId,
        mainKey: DEFAULT_MAIN_KEY,
      }),
    };

    try {
      return await params.processMessage(params.msg, agentRoute, params.groupHistoryKey, {
        groupHistory: groupHistorySnapshot,
        suppressGroupHistoryClear: true,
      });
    } catch (err) {
      whatsappInboundLog.error(`Broadcast agent ${agentId} failed: ${formatError(err)}`);
      return false;
    }
  };

  if (strategy === "sequential") {
    for (const agentId of broadcastAgents) {
      await processForAgent(agentId);
    }
  } else {
    await Promise.allSettled(broadcastAgents.map(processForAgent));
  }

  if (params.msg.chatType === "group") {
    params.groupHistories.set(params.groupHistoryKey, []);
  }

  return true;
}
