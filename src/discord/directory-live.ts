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

import type { ChannelDirectoryEntry } from "../channels/plugins/types.js";
import type { DirectoryConfigParams } from "../channels/plugins/directory-config.js";
import { resolveDiscordAccount } from "./accounts.js";
import { fetchDiscord } from "./api.js";
import { normalizeDiscordSlug } from "./monitor/allow-list.js";
import { normalizeDiscordToken } from "./token.js";

type DiscordGuild = { id: string; name: string };
type DiscordUser = { id: string; username: string; global_name?: string; bot?: boolean };
type DiscordMember = { user: DiscordUser; nick?: string | null };
type DiscordChannel = { id: string; name?: string | null };

function normalizeQuery(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function buildUserRank(user: DiscordUser): number {
  return user.bot ? 0 : 1;
}

export async function listDiscordDirectoryGroupsLive(
  params: DirectoryConfigParams,
): Promise<ChannelDirectoryEntry[]> {
  const account = resolveDiscordAccount({ cfg: params.cfg, accountId: params.accountId });
  const token = normalizeDiscordToken(account.token);
  if (!token) {
    return [];
  }
  const query = normalizeQuery(params.query);
  const guilds = await fetchDiscord<DiscordGuild[]>("/users/@me/guilds", token);
  const rows: ChannelDirectoryEntry[] = [];

  for (const guild of guilds) {
    const channels = await fetchDiscord<DiscordChannel[]>(`/guilds/${guild.id}/channels`, token);
    for (const channel of channels) {
      const name = channel.name?.trim();
      if (!name) {
        continue;
      }
      if (query && !normalizeDiscordSlug(name).includes(normalizeDiscordSlug(query))) {
        continue;
      }
      rows.push({
        kind: "group",
        id: `channel:${channel.id}`,
        name,
        handle: `#${name}`,
        raw: channel,
      });
      if (typeof params.limit === "number" && params.limit > 0 && rows.length >= params.limit) {
        return rows;
      }
    }
  }

  return rows;
}

export async function listDiscordDirectoryPeersLive(
  params: DirectoryConfigParams,
): Promise<ChannelDirectoryEntry[]> {
  const account = resolveDiscordAccount({ cfg: params.cfg, accountId: params.accountId });
  const token = normalizeDiscordToken(account.token);
  if (!token) {
    return [];
  }
  const query = normalizeQuery(params.query);
  if (!query) {
    return [];
  }

  const guilds = await fetchDiscord<DiscordGuild[]>("/users/@me/guilds", token);
  const rows: ChannelDirectoryEntry[] = [];
  const limit = typeof params.limit === "number" && params.limit > 0 ? params.limit : 25;

  for (const guild of guilds) {
    const paramsObj = new URLSearchParams({
      query,
      limit: String(Math.min(limit, 100)),
    });
    const members = await fetchDiscord<DiscordMember[]>(
      `/guilds/${guild.id}/members/search?${paramsObj.toString()}`,
      token,
    );
    for (const member of members) {
      const user = member.user;
      if (!user?.id) {
        continue;
      }
      const name = member.nick?.trim() || user.global_name?.trim() || user.username?.trim();
      rows.push({
        kind: "user",
        id: `user:${user.id}`,
        name: name || undefined,
        handle: user.username ? `@${user.username}` : undefined,
        rank: buildUserRank(user),
        raw: member,
      });
      if (rows.length >= limit) {
        return rows;
      }
    }
  }

  return rows;
}
