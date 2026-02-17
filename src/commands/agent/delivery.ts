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

import { AGENT_LANE_NESTED } from "../../agents/lanes.js";
import { getChannelPlugin, normalizeChannelId } from "../../channels/plugins/index.js";
import { createOutboundSendDeps, type CliDeps } from "../../cli/outbound-send-deps.js";
import type { MarketBotConfig } from "../../config/config.js";
import type { SessionEntry } from "../../config/sessions.js";
import { deliverOutboundPayloads } from "../../infra/outbound/deliver.js";
import { buildOutboundResultEnvelope } from "../../infra/outbound/envelope.js";
import {
  formatOutboundPayloadLog,
  type NormalizedOutboundPayload,
  normalizeOutboundPayloads,
  normalizeOutboundPayloadsForJson,
} from "../../infra/outbound/payloads.js";
import {
  resolveAgentDeliveryPlan,
  resolveAgentOutboundTarget,
} from "../../infra/outbound/agent-delivery.js";
import type { RuntimeEnv } from "../../runtime.js";
import { isInternalMessageChannel } from "../../utils/message-channel.js";
import type { AgentCommandOpts } from "./types.js";

type RunResult = Awaited<
  ReturnType<(typeof import("../../agents/pi-embedded.js"))["runEmbeddedPiAgent"]>
>;

const NESTED_LOG_PREFIX = "[agent:nested]";

function formatNestedLogPrefix(opts: AgentCommandOpts): string {
  const parts = [NESTED_LOG_PREFIX];
  const session = opts.sessionKey ?? opts.sessionId;
  if (session) {
    parts.push(`session=${session}`);
  }
  if (opts.runId) {
    parts.push(`run=${opts.runId}`);
  }
  const channel = opts.messageChannel ?? opts.channel;
  if (channel) {
    parts.push(`channel=${channel}`);
  }
  if (opts.to) {
    parts.push(`to=${opts.to}`);
  }
  if (opts.accountId) {
    parts.push(`account=${opts.accountId}`);
  }
  return parts.join(" ");
}

function logNestedOutput(runtime: RuntimeEnv, opts: AgentCommandOpts, output: string) {
  const prefix = formatNestedLogPrefix(opts);
  for (const line of output.split(/\r?\n/)) {
    if (!line) {
      continue;
    }
    runtime.log(`${prefix} ${line}`);
  }
}

function isExecutionFailureText(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith("⚠️") && normalized.includes("exec:")) {
    return true;
  }
  if (normalized.startsWith("exec:")) {
    return true;
  }
  return normalized.includes(" failed:");
}

function isProgressLikeText(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }
  const lower = normalized.toLowerCase();
  if (
    lower.startsWith("let me ") ||
    lower.startsWith("now let me ") ||
    lower.startsWith("i'll ") ||
    lower.startsWith("i will ")
  ) {
    return true;
  }
  if (
    normalized.startsWith("让我") ||
    normalized.startsWith("现在让我") ||
    normalized.startsWith("我来") ||
    normalized.startsWith("我先") ||
    normalized.startsWith("接下来让我") ||
    normalized.startsWith("然后让我")
  ) {
    return true;
  }
  if (/^(很好|太好了|完美)[！!]/.test(normalized)) {
    return true;
  }
  if (/[:：]\s*$/.test(normalized)) {
    return true;
  }
  return false;
}

function scoreResultLikelihood(payload: NormalizedOutboundPayload, index: number): number {
  const text = payload.text.trim();
  if (!text && payload.mediaUrls.length > 0) {
    return 50 + index;
  }
  if (!text) {
    return -100;
  }
  let score = index;
  if (payload.mediaUrls.length > 0) {
    score += 40;
  }
  if (isExecutionFailureText(text)) {
    score -= 80;
  }
  if (isProgressLikeText(text)) {
    score -= 25;
  }
  const tickers = new Set(
    (text.match(/\b[A-Z]{2,5}\b/g) ?? []).map((entry) => entry.toUpperCase()),
  );
  if (tickers.size >= 3) {
    score += 35;
  }
  if ((text.match(/^\s*\d+\.\s+/gm) ?? []).length >= 2) {
    score += 20;
  }
  if (/\|.+\|/.test(text)) {
    score += 15;
  }
  if (!isProgressLikeText(text) && !isExecutionFailureText(text)) {
    score += 10;
  }
  score += Math.min(15, Math.floor(text.length / 120));
  return score;
}

function pickBestPayload(payloads: NormalizedOutboundPayload[]): NormalizedOutboundPayload | null {
  if (payloads.length === 0) {
    return null;
  }
  let best: NormalizedOutboundPayload | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < payloads.length; i += 1) {
    const candidate = payloads[i];
    const score = scoreResultLikelihood(candidate, i);
    if (!best || score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function appendTimeoutSuffixIfNeeded(
  payload: NormalizedOutboundPayload,
): NormalizedOutboundPayload {
  const text = payload.text.trim();
  if (!text || payload.mediaUrls.length > 0) {
    return payload;
  }
  if (/超时|timeout/i.test(text)) {
    return payload;
  }
  return {
    ...payload,
    text: `${text}\n\n（任务执行超时，以上是当前可用结果。如需我继续完成图表，请回复“继续完成图表”。）`,
  };
}

function selectExternalDeliveryPayloads(params: {
  payloads: NormalizedOutboundPayload[];
  aborted: boolean;
}): NormalizedOutboundPayload[] {
  const { payloads, aborted } = params;
  if (payloads.length <= 1) {
    return payloads;
  }
  const hasMedia = payloads.some((payload) => payload.mediaUrls.length > 0);
  if (hasMedia) {
    const best = pickBestPayload(payloads);
    const mediaPayloads = payloads.filter((payload) => payload.mediaUrls.length > 0);
    if (!best || mediaPayloads.includes(best)) {
      return mediaPayloads;
    }
    return [best, ...mediaPayloads];
  }

  const nonProgress = payloads.filter(
    (payload) => !isProgressLikeText(payload.text) && !isExecutionFailureText(payload.text),
  );
  const best = pickBestPayload(nonProgress.length > 0 ? nonProgress : payloads);
  if (!best) {
    return payloads.slice(-1);
  }
  if (!aborted) {
    return [best];
  }
  return [appendTimeoutSuffixIfNeeded(best)];
}

export async function deliverAgentCommandResult(params: {
  cfg: MarketBotConfig;
  deps: CliDeps;
  runtime: RuntimeEnv;
  opts: AgentCommandOpts;
  sessionEntry: SessionEntry | undefined;
  result: RunResult;
  payloads: RunResult["payloads"];
}) {
  const { cfg, deps, runtime, opts, sessionEntry, payloads, result } = params;
  const deliver = opts.deliver === true;
  const bestEffortDeliver = opts.bestEffortDeliver === true;
  const deliveryPlan = resolveAgentDeliveryPlan({
    sessionEntry,
    requestedChannel: opts.replyChannel ?? opts.channel,
    explicitTo: opts.replyTo ?? opts.to,
    explicitThreadId: opts.threadId,
    accountId: opts.replyAccountId ?? opts.accountId,
    wantsDelivery: deliver,
  });
  const deliveryChannel = deliveryPlan.resolvedChannel;
  // Channel docking: delivery channels are resolved via plugin registry.
  const deliveryPlugin = !isInternalMessageChannel(deliveryChannel)
    ? getChannelPlugin(normalizeChannelId(deliveryChannel) ?? deliveryChannel)
    : undefined;

  const isDeliveryChannelKnown =
    isInternalMessageChannel(deliveryChannel) || Boolean(deliveryPlugin);

  const targetMode =
    opts.deliveryTargetMode ??
    deliveryPlan.deliveryTargetMode ??
    (opts.to ? "explicit" : "implicit");
  const resolvedAccountId = deliveryPlan.resolvedAccountId;
  const resolved =
    deliver && isDeliveryChannelKnown && deliveryChannel
      ? resolveAgentOutboundTarget({
          cfg,
          plan: deliveryPlan,
          targetMode,
          validateExplicitTarget: true,
        })
      : {
          resolvedTarget: null,
          resolvedTo: deliveryPlan.resolvedTo,
          targetMode,
        };
  const resolvedTarget = resolved.resolvedTarget;
  const deliveryTarget = resolved.resolvedTo;
  const resolvedThreadId = deliveryPlan.resolvedThreadId ?? opts.threadId;
  const resolvedReplyToId =
    deliveryChannel === "slack" && resolvedThreadId != null ? String(resolvedThreadId) : undefined;
  const resolvedThreadTarget = deliveryChannel === "slack" ? undefined : resolvedThreadId;

  const logDeliveryError = (err: unknown) => {
    const message = `Delivery failed (${deliveryChannel}${deliveryTarget ? ` to ${deliveryTarget}` : ""}): ${String(err)}`;
    runtime.error?.(message);
    if (!runtime.error) {
      runtime.log(message);
    }
  };

  if (deliver) {
    if (!isDeliveryChannelKnown) {
      const err = new Error(`Unknown channel: ${deliveryChannel}`);
      if (!bestEffortDeliver) {
        throw err;
      }
      logDeliveryError(err);
    } else if (resolvedTarget && !resolvedTarget.ok) {
      if (!bestEffortDeliver) {
        throw resolvedTarget.error;
      }
      logDeliveryError(resolvedTarget.error);
    }
  }

  const normalizedPayloads = normalizeOutboundPayloadsForJson(payloads ?? []);
  if (opts.json) {
    runtime.log(
      JSON.stringify(
        buildOutboundResultEnvelope({
          payloads: normalizedPayloads,
          meta: result.meta,
        }),
        null,
        2,
      ),
    );
    if (!deliver) {
      return { payloads: normalizedPayloads, meta: result.meta };
    }
  }

  if (!payloads || payloads.length === 0) {
    runtime.log("No reply from agent.");
    return { payloads: [], meta: result.meta };
  }

  const normalizedDeliveryPayloads = normalizeOutboundPayloads(payloads);
  const deliveryPayloads =
    deliver && deliveryChannel && !isInternalMessageChannel(deliveryChannel)
      ? selectExternalDeliveryPayloads({
          payloads: normalizedDeliveryPayloads,
          aborted: Boolean(result.meta?.aborted),
        })
      : normalizedDeliveryPayloads;
  const logPayload = (payload: NormalizedOutboundPayload) => {
    if (opts.json) {
      return;
    }
    const output = formatOutboundPayloadLog(payload);
    if (!output) {
      return;
    }
    if (opts.lane === AGENT_LANE_NESTED) {
      logNestedOutput(runtime, opts, output);
      return;
    }
    runtime.log(output);
  };
  if (!deliver) {
    for (const payload of deliveryPayloads) {
      logPayload(payload);
    }
  }
  if (deliver && deliveryChannel && !isInternalMessageChannel(deliveryChannel)) {
    if (deliveryTarget) {
      await deliverOutboundPayloads({
        cfg,
        channel: deliveryChannel,
        to: deliveryTarget,
        accountId: resolvedAccountId,
        payloads: deliveryPayloads,
        replyToId: resolvedReplyToId ?? null,
        threadId: resolvedThreadTarget ?? null,
        bestEffort: bestEffortDeliver,
        onError: (err) => logDeliveryError(err),
        onPayload: logPayload,
        deps: createOutboundSendDeps(deps),
      });
    }
  }

  return { payloads: normalizedPayloads, meta: result.meta };
}
