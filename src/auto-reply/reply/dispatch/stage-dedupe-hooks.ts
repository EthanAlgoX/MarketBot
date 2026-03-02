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

import { logVerbose } from "../../../globals.js";
import { getGlobalHookRunner } from "../../../plugins/hook-runner-global.js";
import type { FinalizedMsgContext } from "../../templating.js";
import type { ReplyDispatcher } from "../reply-dispatcher.js";
import { shouldSkipDuplicateInbound } from "../inbound-dedupe.js";
import type { DispatchFromConfigResult, DispatchRecordProcessed } from "./types.js";

export function maybeHandleDuplicateInbound(params: {
  ctx: FinalizedMsgContext;
  dispatcher: ReplyDispatcher;
  recordProcessed: DispatchRecordProcessed;
}): DispatchFromConfigResult | null {
  if (!shouldSkipDuplicateInbound(params.ctx)) {
    return null;
  }
  params.recordProcessed("skipped", { reason: "duplicate" });
  return { queuedFinal: false, counts: params.dispatcher.getQueuedCounts() };
}

export function runMessageReceivedHook(ctx: FinalizedMsgContext): void {
  const hookRunner = getGlobalHookRunner();
  if (!hookRunner?.hasHooks("message_received")) {
    return;
  }
  const timestamp =
    typeof ctx.Timestamp === "number" && Number.isFinite(ctx.Timestamp) ? ctx.Timestamp : undefined;
  const messageIdForHook =
    ctx.MessageSidFull ?? ctx.MessageSid ?? ctx.MessageSidFirst ?? ctx.MessageSidLast;
  const content =
    typeof ctx.BodyForCommands === "string"
      ? ctx.BodyForCommands
      : typeof ctx.RawBody === "string"
        ? ctx.RawBody
        : typeof ctx.Body === "string"
          ? ctx.Body
          : "";
  const channelId = (ctx.OriginatingChannel ?? ctx.Surface ?? ctx.Provider ?? "").toLowerCase();
  const conversationId = ctx.OriginatingTo ?? ctx.To ?? ctx.From ?? undefined;

  void hookRunner
    .runMessageReceived(
      {
        from: ctx.From ?? "",
        content,
        timestamp,
        metadata: {
          to: ctx.To,
          provider: ctx.Provider,
          surface: ctx.Surface,
          threadId: ctx.MessageThreadId,
          originatingChannel: ctx.OriginatingChannel,
          originatingTo: ctx.OriginatingTo,
          messageId: messageIdForHook,
          senderId: ctx.SenderId,
          senderName: ctx.SenderName,
          senderUsername: ctx.SenderUsername,
          senderE164: ctx.SenderE164,
        },
      },
      {
        channelId,
        accountId: ctx.AccountId,
        conversationId,
      },
    )
    .catch((err) => {
      logVerbose(`dispatch-from-config: message_received hook failed: ${String(err)}`);
    });
}
