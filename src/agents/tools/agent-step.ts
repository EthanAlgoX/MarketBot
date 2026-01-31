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

import crypto from "node:crypto";

import { callGateway } from "../../gateway/call.js";
import { INTERNAL_MESSAGE_CHANNEL } from "../../utils/message-channel.js";
import { AGENT_LANE_NESTED } from "../lanes.js";
import { extractAssistantText, stripToolMessages } from "./sessions-helpers.js";

export async function readLatestAssistantReply(params: {
  sessionKey: string;
  limit?: number;
}): Promise<string | undefined> {
  const history = await callGateway<{ messages: Array<unknown> }>({
    method: "chat.history",
    params: { sessionKey: params.sessionKey, limit: params.limit ?? 50 },
  });
  const filtered = stripToolMessages(Array.isArray(history?.messages) ? history.messages : []);
  const last = filtered.length > 0 ? filtered[filtered.length - 1] : undefined;
  return last ? extractAssistantText(last) : undefined;
}

export async function runAgentStep(params: {
  sessionKey: string;
  message: string;
  extraSystemPrompt: string;
  timeoutMs: number;
  channel?: string;
  lane?: string;
}): Promise<string | undefined> {
  const stepIdem = crypto.randomUUID();
  const response = await callGateway<{ runId?: string }>({
    method: "agent",
    params: {
      message: params.message,
      sessionKey: params.sessionKey,
      idempotencyKey: stepIdem,
      deliver: false,
      channel: params.channel ?? INTERNAL_MESSAGE_CHANNEL,
      lane: params.lane ?? AGENT_LANE_NESTED,
      extraSystemPrompt: params.extraSystemPrompt,
    },
    timeoutMs: 10_000,
  });

  const stepRunId = typeof response?.runId === "string" && response.runId ? response.runId : "";
  const resolvedRunId = stepRunId || stepIdem;
  const stepWaitMs = Math.min(params.timeoutMs, 60_000);
  const wait = await callGateway<{ status?: string }>({
    method: "agent.wait",
    params: {
      runId: resolvedRunId,
      timeoutMs: stepWaitMs,
    },
    timeoutMs: stepWaitMs + 2000,
  });
  if (wait?.status !== "ok") {
    return undefined;
  }
  return await readLatestAssistantReply({ sessionKey: params.sessionKey });
}
