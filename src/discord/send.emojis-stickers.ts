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

import { Routes } from "discord-api-types/v10";

import { loadWebMediaRaw } from "../web/media.js";
import { normalizeEmojiName, resolveDiscordRest } from "./send.shared.js";
import type { DiscordEmojiUpload, DiscordReactOpts, DiscordStickerUpload } from "./send.types.js";
import { DISCORD_MAX_EMOJI_BYTES, DISCORD_MAX_STICKER_BYTES } from "./send.types.js";

export async function listGuildEmojisDiscord(guildId: string, opts: DiscordReactOpts = {}) {
  const rest = resolveDiscordRest(opts);
  return await rest.get(Routes.guildEmojis(guildId));
}

export async function uploadEmojiDiscord(payload: DiscordEmojiUpload, opts: DiscordReactOpts = {}) {
  const rest = resolveDiscordRest(opts);
  const media = await loadWebMediaRaw(payload.mediaUrl, DISCORD_MAX_EMOJI_BYTES);
  const contentType = media.contentType?.toLowerCase();
  if (
    !contentType ||
    !["image/png", "image/jpeg", "image/jpg", "image/gif"].includes(contentType)
  ) {
    throw new Error("Discord emoji uploads require a PNG, JPG, or GIF image");
  }
  const image = `data:${contentType};base64,${media.buffer.toString("base64")}`;
  const roleIds = (payload.roleIds ?? []).map((id) => id.trim()).filter(Boolean);
  return await rest.post(Routes.guildEmojis(payload.guildId), {
    body: {
      name: normalizeEmojiName(payload.name, "Emoji name"),
      image,
      roles: roleIds.length ? roleIds : undefined,
    },
  });
}

export async function uploadStickerDiscord(
  payload: DiscordStickerUpload,
  opts: DiscordReactOpts = {},
) {
  const rest = resolveDiscordRest(opts);
  const media = await loadWebMediaRaw(payload.mediaUrl, DISCORD_MAX_STICKER_BYTES);
  const contentType = media.contentType?.toLowerCase();
  if (!contentType || !["image/png", "image/apng", "application/json"].includes(contentType)) {
    throw new Error("Discord sticker uploads require a PNG, APNG, or Lottie JSON file");
  }
  return await rest.post(Routes.guildStickers(payload.guildId), {
    body: {
      name: normalizeEmojiName(payload.name, "Sticker name"),
      description: normalizeEmojiName(payload.description, "Sticker description"),
      tags: normalizeEmojiName(payload.tags, "Sticker tags"),
      files: [
        {
          data: media.buffer,
          name: media.fileName ?? "sticker",
          contentType,
        },
      ],
    },
  });
}
