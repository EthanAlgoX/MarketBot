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

import type { SlackReactionNotificationMode } from "../../config/config.js";
import type { SlackMessageEvent } from "../types.js";
import {
  applyChannelMatchMeta,
  buildChannelKeyCandidates,
  resolveChannelEntryMatchWithFallback,
  type ChannelMatchSource,
} from "../../channels/channel-config.js";
import { allowListMatches, normalizeAllowListLower, normalizeSlackSlug } from "./allow-list.js";

export type SlackChannelConfigResolved = {
  allowed: boolean;
  requireMention: boolean;
  allowBots?: boolean;
  users?: Array<string | number>;
  skills?: string[];
  systemPrompt?: string;
  matchKey?: string;
  matchSource?: ChannelMatchSource;
};

function firstDefined<T>(...values: Array<T | undefined>) {
  for (const value of values) {
    if (typeof value !== "undefined") {
      return value;
    }
  }
  return undefined;
}

export function shouldEmitSlackReactionNotification(params: {
  mode: SlackReactionNotificationMode | undefined;
  botId?: string | null;
  messageAuthorId?: string | null;
  userId: string;
  userName?: string | null;
  allowlist?: Array<string | number> | null;
}) {
  const { mode, botId, messageAuthorId, userId, userName, allowlist } = params;
  const effectiveMode = mode ?? "own";
  if (effectiveMode === "off") {
    return false;
  }
  if (effectiveMode === "own") {
    if (!botId || !messageAuthorId) {
      return false;
    }
    return messageAuthorId === botId;
  }
  if (effectiveMode === "allowlist") {
    if (!Array.isArray(allowlist) || allowlist.length === 0) {
      return false;
    }
    const users = normalizeAllowListLower(allowlist);
    return allowListMatches({
      allowList: users,
      id: userId,
      name: userName ?? undefined,
    });
  }
  return true;
}

export function resolveSlackChannelLabel(params: { channelId?: string; channelName?: string }) {
  const channelName = params.channelName?.trim();
  if (channelName) {
    const slug = normalizeSlackSlug(channelName);
    return `#${slug || channelName}`;
  }
  const channelId = params.channelId?.trim();
  return channelId ? `#${channelId}` : "unknown channel";
}

export function resolveSlackChannelConfig(params: {
  channelId: string;
  channelName?: string;
  channels?: Record<
    string,
    {
      enabled?: boolean;
      allow?: boolean;
      requireMention?: boolean;
      allowBots?: boolean;
      users?: Array<string | number>;
      skills?: string[];
      systemPrompt?: string;
    }
  >;
  defaultRequireMention?: boolean;
}): SlackChannelConfigResolved | null {
  const { channelId, channelName, channels, defaultRequireMention } = params;
  const entries = channels ?? {};
  const keys = Object.keys(entries);
  const normalizedName = channelName ? normalizeSlackSlug(channelName) : "";
  const directName = channelName ? channelName.trim() : "";
  const candidates = buildChannelKeyCandidates(
    channelId,
    channelName ? `#${directName}` : undefined,
    directName,
    normalizedName,
  );
  const match = resolveChannelEntryMatchWithFallback({
    entries,
    keys: candidates,
    wildcardKey: "*",
  });
  const { entry: matched, wildcardEntry: fallback } = match;

  const requireMentionDefault = defaultRequireMention ?? true;
  if (keys.length === 0) {
    return { allowed: true, requireMention: requireMentionDefault };
  }
  if (!matched && !fallback) {
    return { allowed: false, requireMention: requireMentionDefault };
  }

  const resolved = matched ?? fallback ?? {};
  const allowed =
    firstDefined(resolved.enabled, resolved.allow, fallback?.enabled, fallback?.allow, true) ??
    true;
  const requireMention =
    firstDefined(resolved.requireMention, fallback?.requireMention, requireMentionDefault) ??
    requireMentionDefault;
  const allowBots = firstDefined(resolved.allowBots, fallback?.allowBots);
  const users = firstDefined(resolved.users, fallback?.users);
  const skills = firstDefined(resolved.skills, fallback?.skills);
  const systemPrompt = firstDefined(resolved.systemPrompt, fallback?.systemPrompt);
  const result: SlackChannelConfigResolved = {
    allowed,
    requireMention,
    allowBots,
    users,
    skills,
    systemPrompt,
  };
  return applyChannelMatchMeta(result, match);
}

export type { SlackMessageEvent };
