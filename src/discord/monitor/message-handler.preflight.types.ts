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

import type { ChannelType, Client, User } from "@buape/carbon";
import type { HistoryEntry } from "../../auto-reply/reply/history.js";
import type { ReplyToMode } from "../../config/config.js";
import type { resolveAgentRoute } from "../../routing/resolve-route.js";
import type { DiscordChannelConfigResolved, DiscordGuildEntryResolved } from "./allow-list.js";
import type { DiscordChannelInfo } from "./message-utils.js";
import type { DiscordThreadChannel } from "./threading.js";

export type LoadedConfig = ReturnType<typeof import("../../config/config.js").loadConfig>;
export type RuntimeEnv = import("../../runtime.js").RuntimeEnv;

export type DiscordMessageEvent = import("./listeners.js").DiscordMessageEvent;

export type DiscordMessagePreflightContext = {
  cfg: LoadedConfig;
  discordConfig: NonNullable<
    import("../../config/config.js").MarketBotConfig["channels"]
  >["discord"];
  accountId: string;
  token: string;
  runtime: RuntimeEnv;
  botUserId?: string;
  guildHistories: Map<string, HistoryEntry[]>;
  historyLimit: number;
  mediaMaxBytes: number;
  textLimit: number;
  replyToMode: ReplyToMode;
  ackReactionScope: "all" | "direct" | "group-all" | "group-mentions";
  groupPolicy: "open" | "disabled" | "allowlist";

  data: DiscordMessageEvent;
  client: Client;
  message: DiscordMessageEvent["message"];
  author: User;

  channelInfo: DiscordChannelInfo | null;
  channelName?: string;

  isGuildMessage: boolean;
  isDirectMessage: boolean;
  isGroupDm: boolean;

  commandAuthorized: boolean;
  baseText: string;
  messageText: string;
  wasMentioned: boolean;

  route: ReturnType<typeof resolveAgentRoute>;

  guildInfo: DiscordGuildEntryResolved | null;
  guildSlug: string;

  threadChannel: DiscordThreadChannel | null;
  threadParentId?: string;
  threadParentName?: string;
  threadParentType?: ChannelType;
  threadName?: string | null;

  configChannelName?: string;
  configChannelSlug: string;
  displayChannelName?: string;
  displayChannelSlug: string;

  baseSessionKey: string;
  channelConfig: DiscordChannelConfigResolved | null;
  channelAllowlistConfigured: boolean;
  channelAllowed: boolean;

  shouldRequireMention: boolean;
  hasAnyMention: boolean;
  allowTextCommands: boolean;
  shouldBypassMention: boolean;
  effectiveWasMentioned: boolean;
  canDetectMention: boolean;

  historyEntry?: HistoryEntry;
};

export type DiscordMessagePreflightParams = {
  cfg: LoadedConfig;
  discordConfig: DiscordMessagePreflightContext["discordConfig"];
  accountId: string;
  token: string;
  runtime: RuntimeEnv;
  botUserId?: string;
  guildHistories: Map<string, HistoryEntry[]>;
  historyLimit: number;
  mediaMaxBytes: number;
  textLimit: number;
  replyToMode: ReplyToMode;
  dmEnabled: boolean;
  groupDmEnabled: boolean;
  groupDmChannels?: Array<string | number>;
  allowFrom?: Array<string | number>;
  guildEntries?: Record<string, DiscordGuildEntryResolved>;
  ackReactionScope: DiscordMessagePreflightContext["ackReactionScope"];
  groupPolicy: DiscordMessagePreflightContext["groupPolicy"];
  data: DiscordMessageEvent;
  client: Client;
};
