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
import type { SlackPinEvent } from "../types.js";

export function registerSlackPinEvents(params: { ctx: SlackMonitorContext }) {
  const { ctx } = params;

  ctx.app.event("pin_added", async ({ event, body }: SlackEventMiddlewareArgs<"pin_added">) => {
    try {
      if (ctx.shouldDropMismatchedSlackEvent(body)) {
        return;
      }

      const payload = event as SlackPinEvent;
      const channelId = payload.channel_id;
      const channelInfo = channelId ? await ctx.resolveChannelName(channelId) : {};
      if (
        !ctx.isChannelAllowed({
          channelId,
          channelName: channelInfo?.name,
          channelType: channelInfo?.type,
        })
      ) {
        return;
      }
      const label = resolveSlackChannelLabel({
        channelId,
        channelName: channelInfo?.name,
      });
      const userInfo = payload.user ? await ctx.resolveUserName(payload.user) : {};
      const userLabel = userInfo?.name ?? payload.user ?? "someone";
      const itemType = payload.item?.type ?? "item";
      const messageId = payload.item?.message?.ts ?? payload.event_ts;
      const sessionKey = ctx.resolveSlackSystemEventSessionKey({
        channelId,
        channelType: channelInfo?.type ?? undefined,
      });
      enqueueSystemEvent(`Slack: ${userLabel} pinned a ${itemType} in ${label}.`, {
        sessionKey,
        contextKey: `slack:pin:added:${channelId ?? "unknown"}:${messageId ?? "unknown"}`,
      });
    } catch (err) {
      ctx.runtime.error?.(danger(`slack pin added handler failed: ${String(err)}`));
    }
  });

  ctx.app.event("pin_removed", async ({ event, body }: SlackEventMiddlewareArgs<"pin_removed">) => {
    try {
      if (ctx.shouldDropMismatchedSlackEvent(body)) {
        return;
      }

      const payload = event as SlackPinEvent;
      const channelId = payload.channel_id;
      const channelInfo = channelId ? await ctx.resolveChannelName(channelId) : {};
      if (
        !ctx.isChannelAllowed({
          channelId,
          channelName: channelInfo?.name,
          channelType: channelInfo?.type,
        })
      ) {
        return;
      }
      const label = resolveSlackChannelLabel({
        channelId,
        channelName: channelInfo?.name,
      });
      const userInfo = payload.user ? await ctx.resolveUserName(payload.user) : {};
      const userLabel = userInfo?.name ?? payload.user ?? "someone";
      const itemType = payload.item?.type ?? "item";
      const messageId = payload.item?.message?.ts ?? payload.event_ts;
      const sessionKey = ctx.resolveSlackSystemEventSessionKey({
        channelId,
        channelType: channelInfo?.type ?? undefined,
      });
      enqueueSystemEvent(`Slack: ${userLabel} unpinned a ${itemType} in ${label}.`, {
        sessionKey,
        contextKey: `slack:pin:removed:${channelId ?? "unknown"}:${messageId ?? "unknown"}`,
      });
    } catch (err) {
      ctx.runtime.error?.(danger(`slack pin removed handler failed: ${String(err)}`));
    }
  });
}
