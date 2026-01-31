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

export type {
  DiscordAllowList,
  DiscordChannelConfigResolved,
  DiscordGuildEntryResolved,
} from "./monitor/allow-list.js";
export {
  allowListMatches,
  isDiscordGroupAllowedByPolicy,
  normalizeDiscordAllowList,
  normalizeDiscordSlug,
  resolveDiscordChannelConfig,
  resolveDiscordChannelConfigWithFallback,
  resolveDiscordCommandAuthorized,
  resolveDiscordGuildEntry,
  resolveDiscordShouldRequireMention,
  resolveGroupDmAllow,
  shouldEmitDiscordReactionNotification,
} from "./monitor/allow-list.js";
export type { DiscordMessageEvent, DiscordMessageHandler } from "./monitor/listeners.js";
export { registerDiscordListener } from "./monitor/listeners.js";

export { createDiscordMessageHandler } from "./monitor/message-handler.js";
export { buildDiscordMediaPayload } from "./monitor/message-utils.js";
export { createDiscordNativeCommand } from "./monitor/native-command.js";
export type { MonitorDiscordOpts } from "./monitor/provider.js";
export { monitorDiscordProvider } from "./monitor/provider.js";

export { resolveDiscordReplyTarget, sanitizeDiscordThreadName } from "./monitor/threading.js";
