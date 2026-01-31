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

import type { Guild, User } from "@buape/carbon";

export function resolveDiscordSystemLocation(params: {
  isDirectMessage: boolean;
  isGroupDm: boolean;
  guild?: Guild;
  channelName: string;
}) {
  const { isDirectMessage, isGroupDm, guild, channelName } = params;
  if (isDirectMessage) {
    return "DM";
  }
  if (isGroupDm) {
    return `Group DM #${channelName}`;
  }
  return guild?.name ? `${guild.name} #${channelName}` : `#${channelName}`;
}

export function formatDiscordReactionEmoji(emoji: { id?: string | null; name?: string | null }) {
  if (emoji.id && emoji.name) {
    return `${emoji.name}:${emoji.id}`;
  }
  return emoji.name ?? "emoji";
}

export function formatDiscordUserTag(user: User) {
  const discriminator = (user.discriminator ?? "").trim();
  if (discriminator && discriminator !== "0") {
    return `${user.username}#${discriminator}`;
  }
  return user.username ?? user.id;
}

export function resolveTimestampMs(timestamp?: string | null) {
  if (!timestamp) {
    return undefined;
  }
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? undefined : parsed;
}
