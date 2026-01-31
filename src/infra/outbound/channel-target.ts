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

import { MESSAGE_ACTION_TARGET_MODE } from "./message-action-spec.js";

export const CHANNEL_TARGET_DESCRIPTION =
  "Recipient/channel: E.164 for WhatsApp/Signal, Telegram chat id/@username, Discord/Slack channel/user, or iMessage handle/chat_id";

export const CHANNEL_TARGETS_DESCRIPTION =
  "Recipient/channel targets (same format as --target); accepts ids or names when the directory is available.";

export function applyTargetToParams(params: {
  action: string;
  args: Record<string, unknown>;
}): void {
  const target = typeof params.args.target === "string" ? params.args.target.trim() : "";
  const hasLegacyTo = typeof params.args.to === "string";
  const hasLegacyChannelId = typeof params.args.channelId === "string";
  const mode =
    MESSAGE_ACTION_TARGET_MODE[params.action as keyof typeof MESSAGE_ACTION_TARGET_MODE] ?? "none";

  if (mode !== "none") {
    if (hasLegacyTo || hasLegacyChannelId) {
      throw new Error("Use `target` instead of `to`/`channelId`.");
    }
  } else if (hasLegacyTo) {
    throw new Error("Use `target` for actions that accept a destination.");
  }

  if (!target) {
    return;
  }
  if (mode === "channelId") {
    params.args.channelId = target;
    return;
  }
  if (mode === "to") {
    params.args.to = target;
    return;
  }
  throw new Error(`Action ${params.action} does not accept a target.`);
}
