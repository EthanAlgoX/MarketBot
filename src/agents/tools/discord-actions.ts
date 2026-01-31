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

import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { MarketBotConfig } from "../../config/config.js";
import { createActionGate, readStringParam } from "./common.js";
import { handleDiscordGuildAction } from "./discord-actions-guild.js";
import { handleDiscordMessagingAction } from "./discord-actions-messaging.js";
import { handleDiscordModerationAction } from "./discord-actions-moderation.js";

const messagingActions = new Set([
  "react",
  "reactions",
  "sticker",
  "poll",
  "permissions",
  "fetchMessage",
  "readMessages",
  "sendMessage",
  "editMessage",
  "deleteMessage",
  "threadCreate",
  "threadList",
  "threadReply",
  "pinMessage",
  "unpinMessage",
  "listPins",
  "searchMessages",
]);

const guildActions = new Set([
  "memberInfo",
  "roleInfo",
  "emojiList",
  "emojiUpload",
  "stickerUpload",
  "roleAdd",
  "roleRemove",
  "channelInfo",
  "channelList",
  "voiceStatus",
  "eventList",
  "eventCreate",
  "channelCreate",
  "channelEdit",
  "channelDelete",
  "channelMove",
  "categoryCreate",
  "categoryEdit",
  "categoryDelete",
  "channelPermissionSet",
  "channelPermissionRemove",
]);

const moderationActions = new Set(["timeout", "kick", "ban"]);

export async function handleDiscordAction(
  params: Record<string, unknown>,
  cfg: MarketBotConfig,
): Promise<AgentToolResult<unknown>> {
  const action = readStringParam(params, "action", { required: true });
  const isActionEnabled = createActionGate(cfg.channels?.discord?.actions);

  if (messagingActions.has(action)) {
    return await handleDiscordMessagingAction(action, params, isActionEnabled);
  }
  if (guildActions.has(action)) {
    return await handleDiscordGuildAction(action, params, isActionEnabled);
  }
  if (moderationActions.has(action)) {
    return await handleDiscordModerationAction(action, params, isActionEnabled);
  }
  throw new Error(`Unknown action: ${action}`);
}
