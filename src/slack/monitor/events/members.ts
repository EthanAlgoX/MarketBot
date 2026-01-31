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

import type { SlackEventMiddlewareArgs } from "@slack/bolt";

import { danger } from "../../../globals.js";
import { enqueueSystemEvent } from "../../../infra/system-events.js";

import { resolveSlackChannelLabel } from "../channel-config.js";
import type { SlackMonitorContext } from "../context.js";
import type { SlackMemberChannelEvent } from "../types.js";

export function registerSlackMemberEvents(params: { ctx: SlackMonitorContext }) {
  const { ctx } = params;

  ctx.app.event(
    "member_joined_channel",
    async ({ event, body }: SlackEventMiddlewareArgs<"member_joined_channel">) => {
      try {
        if (ctx.shouldDropMismatchedSlackEvent(body)) {
          return;
        }
        const payload = event as SlackMemberChannelEvent;
        const channelId = payload.channel;
        const channelInfo = channelId ? await ctx.resolveChannelName(channelId) : {};
        const channelType = payload.channel_type ?? channelInfo?.type;
        if (
          !ctx.isChannelAllowed({
            channelId,
            channelName: channelInfo?.name,
            channelType,
          })
        ) {
          return;
        }
        const userInfo = payload.user ? await ctx.resolveUserName(payload.user) : {};
        const userLabel = userInfo?.name ?? payload.user ?? "someone";
        const label = resolveSlackChannelLabel({
          channelId,
          channelName: channelInfo?.name,
        });
        const sessionKey = ctx.resolveSlackSystemEventSessionKey({
          channelId,
          channelType,
        });
        enqueueSystemEvent(`Slack: ${userLabel} joined ${label}.`, {
          sessionKey,
          contextKey: `slack:member:joined:${channelId ?? "unknown"}:${payload.user ?? "unknown"}`,
        });
      } catch (err) {
        ctx.runtime.error?.(danger(`slack join handler failed: ${String(err)}`));
      }
    },
  );

  ctx.app.event(
    "member_left_channel",
    async ({ event, body }: SlackEventMiddlewareArgs<"member_left_channel">) => {
      try {
        if (ctx.shouldDropMismatchedSlackEvent(body)) {
          return;
        }
        const payload = event as SlackMemberChannelEvent;
        const channelId = payload.channel;
        const channelInfo = channelId ? await ctx.resolveChannelName(channelId) : {};
        const channelType = payload.channel_type ?? channelInfo?.type;
        if (
          !ctx.isChannelAllowed({
            channelId,
            channelName: channelInfo?.name,
            channelType,
          })
        ) {
          return;
        }
        const userInfo = payload.user ? await ctx.resolveUserName(payload.user) : {};
        const userLabel = userInfo?.name ?? payload.user ?? "someone";
        const label = resolveSlackChannelLabel({
          channelId,
          channelName: channelInfo?.name,
        });
        const sessionKey = ctx.resolveSlackSystemEventSessionKey({
          channelId,
          channelType,
        });
        enqueueSystemEvent(`Slack: ${userLabel} left ${label}.`, {
          sessionKey,
          contextKey: `slack:member:left:${channelId ?? "unknown"}:${payload.user ?? "unknown"}`,
        });
      } catch (err) {
        ctx.runtime.error?.(danger(`slack leave handler failed: ${String(err)}`));
      }
    },
  );
}
