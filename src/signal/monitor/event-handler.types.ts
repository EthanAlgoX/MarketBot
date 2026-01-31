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

import type { HistoryEntry } from "../../auto-reply/reply/history.js";
import type { ReplyPayload } from "../../auto-reply/types.js";
import type { MarketBotConfig } from "../../config/config.js";
import type { DmPolicy, GroupPolicy, SignalReactionNotificationMode } from "../../config/types.js";
import type { RuntimeEnv } from "../../runtime.js";
import type { SignalSender } from "../identity.js";

export type SignalEnvelope = {
  sourceNumber?: string | null;
  sourceUuid?: string | null;
  sourceName?: string | null;
  timestamp?: number | null;
  dataMessage?: SignalDataMessage | null;
  editMessage?: { dataMessage?: SignalDataMessage | null } | null;
  syncMessage?: unknown;
  reactionMessage?: SignalReactionMessage | null;
};

export type SignalDataMessage = {
  timestamp?: number;
  message?: string | null;
  attachments?: Array<SignalAttachment>;
  groupInfo?: {
    groupId?: string | null;
    groupName?: string | null;
  } | null;
  quote?: { text?: string | null } | null;
  reaction?: SignalReactionMessage | null;
};

export type SignalReactionMessage = {
  emoji?: string | null;
  targetAuthor?: string | null;
  targetAuthorUuid?: string | null;
  targetSentTimestamp?: number | null;
  isRemove?: boolean | null;
  groupInfo?: {
    groupId?: string | null;
    groupName?: string | null;
  } | null;
};

export type SignalAttachment = {
  id?: string | null;
  contentType?: string | null;
  filename?: string | null;
  size?: number | null;
};

export type SignalReactionTarget = {
  kind: "phone" | "uuid";
  id: string;
  display: string;
};

export type SignalReceivePayload = {
  envelope?: SignalEnvelope | null;
  exception?: { message?: string } | null;
};

export type SignalEventHandlerDeps = {
  runtime: RuntimeEnv;
  cfg: MarketBotConfig;
  baseUrl: string;
  account?: string;
  accountId: string;
  blockStreaming?: boolean;
  historyLimit: number;
  groupHistories: Map<string, HistoryEntry[]>;
  textLimit: number;
  dmPolicy: DmPolicy;
  allowFrom: string[];
  groupAllowFrom: string[];
  groupPolicy: GroupPolicy;
  reactionMode: SignalReactionNotificationMode;
  reactionAllowlist: string[];
  mediaMaxBytes: number;
  ignoreAttachments: boolean;
  sendReadReceipts: boolean;
  readReceiptsViaDaemon: boolean;
  fetchAttachment: (params: {
    baseUrl: string;
    account?: string;
    attachment: SignalAttachment;
    sender?: string;
    groupId?: string;
    maxBytes: number;
  }) => Promise<{ path: string; contentType?: string } | null>;
  deliverReplies: (params: {
    replies: ReplyPayload[];
    target: string;
    baseUrl: string;
    account?: string;
    accountId?: string;
    runtime: RuntimeEnv;
    maxBytes: number;
    textLimit: number;
  }) => Promise<void>;
  resolveSignalReactionTargets: (reaction: SignalReactionMessage) => SignalReactionTarget[];
  isSignalReactionMessage: (
    reaction: SignalReactionMessage | null | undefined,
  ) => reaction is SignalReactionMessage;
  shouldEmitSignalReactionNotification: (params: {
    mode?: SignalReactionNotificationMode;
    account?: string | null;
    targets?: SignalReactionTarget[];
    sender?: SignalSender | null;
    allowlist?: string[];
  }) => boolean;
  buildSignalReactionSystemEventText: (params: {
    emojiLabel: string;
    actorLabel: string;
    messageId: string;
    targetLabel?: string;
    groupLabel?: string;
  }) => string;
};
