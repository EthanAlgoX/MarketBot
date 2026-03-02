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

import { isDiagnosticsEnabled } from "../../infra/diagnostic-events.js";
import {
  logMessageProcessed,
  logMessageQueued,
  logSessionStateChange,
} from "../../logging/diagnostic.js";
import { getReplyFromConfig } from "../reply.js";
import { formatAbortReplyText, tryFastAbortFromMessage } from "./abort.js";
import type { DispatchFromConfigResult, DispatchReplyFromConfigParams } from "./dispatch/types.js";
import {
  maybeHandleDuplicateInbound,
  runMessageReceivedHook,
} from "./dispatch/stage-dedupe-hooks.js";
import { createRouteStage } from "./dispatch/stage-route.js";
import {
  createTtsStage,
  isInboundAudioContext,
  resolveSessionTtsAuto,
} from "./dispatch/stage-tts.js";

export type { DispatchFromConfigResult } from "./dispatch/types.js";

export async function dispatchReplyFromConfig(
  params: DispatchReplyFromConfigParams,
): Promise<DispatchFromConfigResult> {
  const { ctx, cfg, dispatcher } = params;
  const diagnosticsEnabled = isDiagnosticsEnabled(cfg);
  const channel = String(ctx.Surface ?? ctx.Provider ?? "unknown").toLowerCase();
  const chatId = ctx.To ?? ctx.From;
  const messageId = ctx.MessageSid ?? ctx.MessageSidFirst ?? ctx.MessageSidLast;
  const sessionKey = ctx.SessionKey;
  const startTime = diagnosticsEnabled ? Date.now() : 0;
  const canTrackSession = diagnosticsEnabled && Boolean(sessionKey);

  const recordProcessed = (
    outcome: "completed" | "skipped" | "error",
    opts?: {
      reason?: string;
      error?: string;
    },
  ) => {
    if (!diagnosticsEnabled) {
      return;
    }
    logMessageProcessed({
      channel,
      chatId,
      messageId,
      sessionKey,
      durationMs: Date.now() - startTime,
      outcome,
      reason: opts?.reason,
      error: opts?.error,
    });
  };

  const markProcessing = () => {
    if (!canTrackSession || !sessionKey) {
      return;
    }
    logMessageQueued({ sessionKey, channel, source: "dispatch" });
    logSessionStateChange({
      sessionKey,
      state: "processing",
      reason: "message_start",
    });
  };

  const markIdle = (reason: string) => {
    if (!canTrackSession || !sessionKey) {
      return;
    }
    logSessionStateChange({
      sessionKey,
      state: "idle",
      reason,
    });
  };

  const duplicateResult = maybeHandleDuplicateInbound({
    ctx,
    dispatcher,
    recordProcessed,
  });
  if (duplicateResult) {
    return duplicateResult;
  }

  const inboundAudio = isInboundAudioContext(ctx);
  const sessionTtsAuto = resolveSessionTtsAuto(ctx, cfg);
  runMessageReceivedHook(ctx);
  const routeStage = createRouteStage({ ctx, cfg, dispatcher });

  markProcessing();

  try {
    const fastAbort = await tryFastAbortFromMessage({ ctx, cfg });
    if (fastAbort.handled) {
      const payload = {
        text: formatAbortReplyText(fastAbort.stoppedSubagents),
      };
      const fastAbortResult = await routeStage.sendFinalPayload(payload, "abort");
      await dispatcher.waitForIdle();
      const counts = dispatcher.getQueuedCounts();
      counts.final += fastAbortResult.routed ? 1 : 0;
      recordProcessed("completed", { reason: "fast_abort" });
      markIdle("message_completed");
      return { queuedFinal: fastAbortResult.queued, counts };
    }

    const ttsStage = createTtsStage({
      ctx,
      cfg,
      dispatcher,
      routeStage,
      inboundAudio,
      sessionTtsAuto,
    });

    const replyResult = await (params.replyResolver ?? getReplyFromConfig)(
      ctx,
      {
        ...params.replyOptions,
        onToolResult: ttsStage.onToolResult,
        onBlockReply: ttsStage.onBlockReply,
      },
      cfg,
    );

    const { queuedFinal, routedFinalCount } = await ttsStage.dispatchFinalReplies(replyResult);

    await dispatcher.waitForIdle();

    const counts = dispatcher.getQueuedCounts();
    counts.final += routedFinalCount;
    recordProcessed("completed");
    markIdle("message_completed");
    return { queuedFinal, counts };
  } catch (err) {
    recordProcessed("error", { error: String(err) });
    markIdle("message_error");
    throw err;
  }
}
