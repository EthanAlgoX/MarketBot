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

import { resolveSessionAgentId } from "../../../agents/agent-scope.js";
import type { MarketBotConfig } from "../../../config/config.js";
import { loadSessionStore, resolveStorePath } from "../../../config/sessions.js";
import { logVerbose } from "../../../globals.js";
import {
  maybeApplyTtsToPayload,
  normalizeTtsAutoMode,
  resolveTtsConfig,
} from "../../../tts/tts.js";
import type { FinalizedMsgContext } from "../../templating.js";
import type { GetReplyOptions, ReplyPayload } from "../../types.js";
import type { ReplyDispatcher } from "../reply-dispatcher.js";
import type { RouteStage } from "./types.js";

const AUDIO_PLACEHOLDER_RE = /^<media:audio>(\s*\([^)]*\))?$/i;
const AUDIO_HEADER_RE = /^\[Audio\b/i;

const normalizeMediaType = (value: string): string => value.split(";")[0]?.trim().toLowerCase();

export function isInboundAudioContext(ctx: FinalizedMsgContext): boolean {
  const rawTypes = [
    typeof ctx.MediaType === "string" ? ctx.MediaType : undefined,
    ...(Array.isArray(ctx.MediaTypes) ? ctx.MediaTypes : []),
  ].filter(Boolean) as string[];
  const types = rawTypes.map((type) => normalizeMediaType(type));
  if (types.some((type) => type === "audio" || type.startsWith("audio/"))) {
    return true;
  }

  const body =
    typeof ctx.BodyForCommands === "string"
      ? ctx.BodyForCommands
      : typeof ctx.CommandBody === "string"
        ? ctx.CommandBody
        : typeof ctx.RawBody === "string"
          ? ctx.RawBody
          : typeof ctx.Body === "string"
            ? ctx.Body
            : "";
  const trimmed = body.trim();
  if (!trimmed) {
    return false;
  }
  if (AUDIO_PLACEHOLDER_RE.test(trimmed)) {
    return true;
  }
  return AUDIO_HEADER_RE.test(trimmed);
}

export function resolveSessionTtsAuto(
  ctx: FinalizedMsgContext,
  cfg: MarketBotConfig,
): string | undefined {
  const targetSessionKey =
    ctx.CommandSource === "native" ? ctx.CommandTargetSessionKey?.trim() : undefined;
  const sessionKey = (targetSessionKey ?? ctx.SessionKey)?.trim();
  if (!sessionKey) {
    return undefined;
  }
  const agentId = resolveSessionAgentId({ sessionKey, config: cfg });
  const storePath = resolveStorePath(cfg.session?.store, { agentId });
  try {
    const store = loadSessionStore(storePath);
    const entry = store[sessionKey.toLowerCase()] ?? store[sessionKey];
    return normalizeTtsAutoMode(entry?.ttsAuto);
  } catch {
    return undefined;
  }
}

type ToolResultHandler = NonNullable<GetReplyOptions["onToolResult"]>;
type BlockReplyHandler = NonNullable<GetReplyOptions["onBlockReply"]>;

export type TtsStage = {
  onToolResult?: ToolResultHandler;
  onBlockReply: BlockReplyHandler;
  dispatchFinalReplies: (
    replyResult: ReplyPayload | ReplyPayload[] | undefined,
  ) => Promise<{ queuedFinal: boolean; routedFinalCount: number }>;
};

export function createTtsStage(params: {
  ctx: FinalizedMsgContext;
  cfg: MarketBotConfig;
  dispatcher: ReplyDispatcher;
  routeStage: RouteStage;
  inboundAudio: boolean;
  sessionTtsAuto?: string;
}): TtsStage {
  const { ctx, cfg, dispatcher, routeStage, inboundAudio, sessionTtsAuto } = params;
  let accumulatedBlockText = "";
  let blockCount = 0;

  const onToolResult: ToolResultHandler | undefined =
    ctx.ChatType !== "group" && ctx.CommandSource !== "native"
      ? async (payload: ReplyPayload) => {
          const ttsPayload = await maybeApplyTtsToPayload({
            payload,
            cfg,
            channel: routeStage.ttsChannel,
            kind: "tool",
            inboundAudio,
            ttsAuto: sessionTtsAuto,
          });
          if (routeStage.shouldRouteToOriginating) {
            await routeStage.sendPayloadAsync(ttsPayload, undefined, false);
          } else {
            dispatcher.sendToolResult(ttsPayload);
          }
        }
      : undefined;

  const onBlockReply: BlockReplyHandler = async (payload, context) => {
    if (payload.text) {
      if (accumulatedBlockText.length > 0) {
        accumulatedBlockText += "\n";
      }
      accumulatedBlockText += payload.text;
      blockCount++;
    }
    const ttsPayload = await maybeApplyTtsToPayload({
      payload,
      cfg,
      channel: routeStage.ttsChannel,
      kind: "block",
      inboundAudio,
      ttsAuto: sessionTtsAuto,
    });
    if (routeStage.shouldRouteToOriginating) {
      await routeStage.sendPayloadAsync(ttsPayload, context?.abortSignal, false);
    } else {
      dispatcher.sendBlockReply(ttsPayload);
    }
  };

  const dispatchFinalReplies = async (
    replyResult: ReplyPayload | ReplyPayload[] | undefined,
  ): Promise<{ queuedFinal: boolean; routedFinalCount: number }> => {
    const replies = replyResult ? (Array.isArray(replyResult) ? replyResult : [replyResult]) : [];
    let queuedFinal = false;
    let routedFinalCount = 0;

    for (const reply of replies) {
      const ttsReply = await maybeApplyTtsToPayload({
        payload: reply,
        cfg,
        channel: routeStage.ttsChannel,
        kind: "final",
        inboundAudio,
        ttsAuto: sessionTtsAuto,
      });
      const sent = await routeStage.sendFinalPayload(ttsReply, "final");
      queuedFinal = sent.queued || queuedFinal;
      if (sent.routed) {
        routedFinalCount += 1;
      }
    }

    const ttsMode = resolveTtsConfig(cfg).mode ?? "final";
    if (
      ttsMode === "final" &&
      replies.length === 0 &&
      blockCount > 0 &&
      accumulatedBlockText.trim()
    ) {
      try {
        const ttsSyntheticReply = await maybeApplyTtsToPayload({
          payload: { text: accumulatedBlockText },
          cfg,
          channel: routeStage.ttsChannel,
          kind: "final",
          inboundAudio,
          ttsAuto: sessionTtsAuto,
        });
        if (ttsSyntheticReply.mediaUrl) {
          const ttsOnlyPayload: ReplyPayload = {
            mediaUrl: ttsSyntheticReply.mediaUrl,
            audioAsVoice: ttsSyntheticReply.audioAsVoice,
          };
          const sent = await routeStage.sendFinalPayload(ttsOnlyPayload, "tts-only");
          queuedFinal = sent.queued || queuedFinal;
          if (sent.routed) {
            routedFinalCount += 1;
          }
        }
      } catch (err) {
        logVerbose(
          `dispatch-from-config: accumulated block TTS failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { queuedFinal, routedFinalCount };
  };

  return {
    onToolResult,
    onBlockReply,
    dispatchFinalReplies,
  };
}
