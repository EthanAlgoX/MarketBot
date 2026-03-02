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

import type { MarketBotConfig } from "../../../config/config.js";
import type { getReplyFromConfig } from "../../reply.js";
import type { FinalizedMsgContext } from "../../templating.js";
import type { GetReplyOptions, ReplyPayload } from "../../types.js";
import type { ReplyDispatcher, ReplyDispatchKind } from "../reply-dispatcher.js";

export type DispatchFromConfigResult = {
  queuedFinal: boolean;
  counts: Record<ReplyDispatchKind, number>;
};

export type DispatchReplyFromConfigParams = {
  ctx: FinalizedMsgContext;
  cfg: MarketBotConfig;
  dispatcher: ReplyDispatcher;
  replyOptions?: Omit<GetReplyOptions, "onToolResult" | "onBlockReply">;
  replyResolver?: typeof getReplyFromConfig;
};

export type DispatchRecordProcessed = (
  outcome: "completed" | "skipped" | "error",
  opts?: {
    reason?: string;
    error?: string;
  },
) => void;

export type RouteReplyFailureLabel = "abort" | "final" | "tts-only";

export type RouteStage = {
  shouldRouteToOriginating: boolean;
  ttsChannel: string | undefined;
  sendPayloadAsync: (
    payload: ReplyPayload,
    abortSignal?: AbortSignal,
    mirror?: boolean,
  ) => Promise<void>;
  sendFinalPayload: (
    payload: ReplyPayload,
    failureLabel: RouteReplyFailureLabel,
  ) => Promise<{ queued: boolean; routed: boolean }>;
};
