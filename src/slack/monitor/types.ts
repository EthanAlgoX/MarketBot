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

import type { MarketBotConfig, SlackSlashCommandConfig } from "../../config/config.js";
import type { RuntimeEnv } from "../../runtime.js";
import type { SlackFile, SlackMessageEvent } from "../types.js";

export type MonitorSlackOpts = {
  botToken?: string;
  appToken?: string;
  accountId?: string;
  mode?: "socket" | "http";
  config?: MarketBotConfig;
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
  mediaMaxMb?: number;
  slashCommand?: SlackSlashCommandConfig;
};

export type SlackReactionEvent = {
  type: "reaction_added" | "reaction_removed";
  user?: string;
  reaction?: string;
  item?: {
    type?: string;
    channel?: string;
    ts?: string;
  };
  item_user?: string;
  event_ts?: string;
};

export type SlackMemberChannelEvent = {
  type: "member_joined_channel" | "member_left_channel";
  user?: string;
  channel?: string;
  channel_type?: SlackMessageEvent["channel_type"];
  event_ts?: string;
};

export type SlackChannelCreatedEvent = {
  type: "channel_created";
  channel?: { id?: string; name?: string };
  event_ts?: string;
};

export type SlackChannelRenamedEvent = {
  type: "channel_rename";
  channel?: { id?: string; name?: string; name_normalized?: string };
  event_ts?: string;
};

export type SlackChannelIdChangedEvent = {
  type: "channel_id_changed";
  old_channel_id?: string;
  new_channel_id?: string;
  event_ts?: string;
};

export type SlackPinEvent = {
  type: "pin_added" | "pin_removed";
  channel_id?: string;
  user?: string;
  item?: { type?: string; message?: { ts?: string } };
  event_ts?: string;
};

export type SlackMessageChangedEvent = {
  type: "message";
  subtype: "message_changed";
  channel?: string;
  message?: { ts?: string };
  previous_message?: { ts?: string };
  event_ts?: string;
};

export type SlackMessageDeletedEvent = {
  type: "message";
  subtype: "message_deleted";
  channel?: string;
  deleted_ts?: string;
  event_ts?: string;
};

export type SlackThreadBroadcastEvent = {
  type: "message";
  subtype: "thread_broadcast";
  channel?: string;
  message?: { ts?: string };
  event_ts?: string;
};

export type { SlackFile, SlackMessageEvent };
