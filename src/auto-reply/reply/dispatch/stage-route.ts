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
import { logVerbose } from "../../../globals.js";
import type { FinalizedMsgContext } from "../../templating.js";
import type { ReplyPayload } from "../../types.js";
import type { ReplyDispatcher } from "../reply-dispatcher.js";
import { isRoutableChannel, routeReply } from "../route-reply.js";
import type { RouteReplyFailureLabel, RouteStage } from "./types.js";

function formatRouteFailureMessage(label: RouteReplyFailureLabel): string {
  return `dispatch-from-config: route-reply (${label}) failed: `;
}

export function createRouteStage(params: {
  ctx: FinalizedMsgContext;
  cfg: MarketBotConfig;
  dispatcher: ReplyDispatcher;
}): RouteStage {
  const { ctx, cfg, dispatcher } = params;
  const originatingChannel = ctx.OriginatingChannel;
  const originatingTo = ctx.OriginatingTo;
  const currentSurface = (ctx.Surface ?? ctx.Provider)?.toLowerCase();
  const shouldRouteToOriginating =
    isRoutableChannel(originatingChannel) &&
    Boolean(originatingTo) &&
    originatingChannel !== currentSurface;
  const ttsChannel = shouldRouteToOriginating ? originatingChannel : currentSurface;

  const sendPayloadAsync = async (
    payload: ReplyPayload,
    abortSignal?: AbortSignal,
    mirror?: boolean,
  ): Promise<void> => {
    if (!originatingChannel || !originatingTo || abortSignal?.aborted) {
      return;
    }
    const result = await routeReply({
      payload,
      channel: originatingChannel,
      to: originatingTo,
      sessionKey: ctx.SessionKey,
      accountId: ctx.AccountId,
      threadId: ctx.MessageThreadId,
      cfg,
      abortSignal,
      mirror,
    });
    if (!result.ok) {
      logVerbose(`dispatch-from-config: route-reply failed: ${result.error ?? "unknown error"}`);
    }
  };

  const sendFinalPayload = async (
    payload: ReplyPayload,
    failureLabel: RouteReplyFailureLabel,
  ): Promise<{ queued: boolean; routed: boolean }> => {
    if (!shouldRouteToOriginating || !originatingChannel || !originatingTo) {
      return { queued: dispatcher.sendFinalReply(payload), routed: false };
    }

    const result = await routeReply({
      payload,
      channel: originatingChannel,
      to: originatingTo,
      sessionKey: ctx.SessionKey,
      accountId: ctx.AccountId,
      threadId: ctx.MessageThreadId,
      cfg,
    });
    if (!result.ok) {
      logVerbose(`${formatRouteFailureMessage(failureLabel)}${result.error ?? "unknown error"}`);
    }
    return { queued: result.ok, routed: result.ok };
  };

  return {
    shouldRouteToOriginating,
    ttsChannel,
    sendPayloadAsync,
    sendFinalPayload,
  };
}
