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

export const CHANNEL_MESSAGE_ACTION_NAMES = [
  "send",
  "broadcast",
  "poll",
  "react",
  "reactions",
  "read",
  "edit",
  "unsend",
  "reply",
  "sendWithEffect",
  "renameGroup",
  "setGroupIcon",
  "addParticipant",
  "removeParticipant",
  "leaveGroup",
  "sendAttachment",
  "delete",
  "pin",
  "unpin",
  "list-pins",
  "permissions",
  "thread-create",
  "thread-list",
  "thread-reply",
  "search",
  "sticker",
  "sticker-search",
  "member-info",
  "role-info",
  "emoji-list",
  "emoji-upload",
  "sticker-upload",
  "role-add",
  "role-remove",
  "channel-info",
  "channel-list",
  "channel-create",
  "channel-edit",
  "channel-delete",
  "channel-move",
  "category-create",
  "category-edit",
  "category-delete",
  "voice-status",
  "event-list",
  "event-create",
  "timeout",
  "kick",
  "ban",
] as const;

export type ChannelMessageActionName = (typeof CHANNEL_MESSAGE_ACTION_NAMES)[number];
