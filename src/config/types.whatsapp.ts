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

import type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  GroupPolicy,
  MarkdownConfig,
} from "./types.base.js";
import type { ChannelHeartbeatVisibilityConfig } from "./types.channels.js";
import type { DmConfig } from "./types.messages.js";
import type { GroupToolPolicyBySenderConfig, GroupToolPolicyConfig } from "./types.tools.js";

export type WhatsAppActionConfig = {
  reactions?: boolean;
  sendMessage?: boolean;
  polls?: boolean;
};

export type WhatsAppConfig = {
  /** Optional per-account WhatsApp configuration (multi-account). */
  accounts?: Record<string, WhatsAppAccountConfig>;
  /** Optional provider capability tags used for agent/runtime guidance. */
  capabilities?: string[];
  /** Markdown formatting overrides (tables). */
  markdown?: MarkdownConfig;
  /** Allow channel-initiated config writes (default: true). */
  configWrites?: boolean;
  /** Send read receipts for incoming messages (default true). */
  sendReadReceipts?: boolean;
  /**
   * Inbound message prefix (WhatsApp only).
   * Default: `[{agents.list[].identity.name}]` (or `[marketbot]`) when allowFrom is empty, else `""`.
   */
  messagePrefix?: string;
  /** Direct message access policy (default: pairing). */
  dmPolicy?: DmPolicy;
  /**
   * Same-phone setup (bot uses your personal WhatsApp number).
   */
  selfChatMode?: boolean;
  /** Optional allowlist for WhatsApp direct chats (E.164). */
  allowFrom?: string[];
  /** Optional allowlist for WhatsApp group senders (E.164). */
  groupAllowFrom?: string[];
  /**
   * Controls how group messages are handled:
   * - "open": groups bypass allowFrom, only mention-gating applies
   * - "disabled": block all group messages entirely
   * - "allowlist": only allow group messages from senders in groupAllowFrom/allowFrom
   */
  groupPolicy?: GroupPolicy;
  /** Max group messages to keep as history context (0 disables). */
  historyLimit?: number;
  /** Max DM turns to keep as history context. */
  dmHistoryLimit?: number;
  /** Per-DM config overrides keyed by user ID. */
  dms?: Record<string, DmConfig>;
  /** Outbound text chunk size (chars). Default: 4000. */
  textChunkLimit?: number;
  /** Chunking mode: "length" (default) splits by size; "newline" splits on every newline. */
  chunkMode?: "length" | "newline";
  /** Maximum media file size in MB. Default: 50. */
  mediaMaxMb?: number;
  /** Disable block streaming for this account. */
  blockStreaming?: boolean;
  /** Merge streamed block replies before sending. */
  blockStreamingCoalesce?: BlockStreamingCoalesceConfig;
  /** Per-action tool gating (default: true for all). */
  actions?: WhatsAppActionConfig;
  groups?: Record<
    string,
    {
      requireMention?: boolean;
      tools?: GroupToolPolicyConfig;
      toolsBySender?: GroupToolPolicyBySenderConfig;
    }
  >;
  /** Acknowledgment reaction sent immediately upon message receipt. */
  ackReaction?: {
    /** Emoji to use for acknowledgment (e.g., "👀"). Empty = disabled. */
    emoji?: string;
    /** Send reactions in direct chats. Default: true. */
    direct?: boolean;
    /**
     * Send reactions in group chats:
     * - "always": react to all group messages
     * - "mentions": react only when bot is mentioned
     * - "never": never react in groups
     * Default: "mentions"
     */
    group?: "always" | "mentions" | "never";
  };
  /** Debounce window (ms) for batching rapid consecutive messages from the same sender (0 to disable). */
  debounceMs?: number;
  /** Heartbeat visibility settings for this channel. */
  heartbeat?: ChannelHeartbeatVisibilityConfig;
};

export type WhatsAppAccountConfig = {
  /** Optional display name for this account (used in CLI/UI lists). */
  name?: string;
  /** Optional provider capability tags used for agent/runtime guidance. */
  capabilities?: string[];
  /** Markdown formatting overrides (tables). */
  markdown?: MarkdownConfig;
  /** Allow channel-initiated config writes (default: true). */
  configWrites?: boolean;
  /** If false, do not start this WhatsApp account provider. Default: true. */
  enabled?: boolean;
  /** Send read receipts for incoming messages (default true). */
  sendReadReceipts?: boolean;
  /** Inbound message prefix override for this account (WhatsApp only). */
  messagePrefix?: string;
  /** Override auth directory (Baileys multi-file auth state). */
  authDir?: string;
  /** Direct message access policy (default: pairing). */
  dmPolicy?: DmPolicy;
  /** Same-phone setup for this account (bot uses your personal WhatsApp number). */
  selfChatMode?: boolean;
  allowFrom?: string[];
  groupAllowFrom?: string[];
  groupPolicy?: GroupPolicy;
  /** Max group messages to keep as history context (0 disables). */
  historyLimit?: number;
  /** Max DM turns to keep as history context. */
  dmHistoryLimit?: number;
  /** Per-DM config overrides keyed by user ID. */
  dms?: Record<string, DmConfig>;
  textChunkLimit?: number;
  /** Chunking mode: "length" (default) splits by size; "newline" splits on every newline. */
  chunkMode?: "length" | "newline";
  mediaMaxMb?: number;
  blockStreaming?: boolean;
  /** Merge streamed block replies before sending. */
  blockStreamingCoalesce?: BlockStreamingCoalesceConfig;
  groups?: Record<
    string,
    {
      requireMention?: boolean;
      tools?: GroupToolPolicyConfig;
      toolsBySender?: GroupToolPolicyBySenderConfig;
    }
  >;
  /** Acknowledgment reaction sent immediately upon message receipt. */
  ackReaction?: {
    /** Emoji to use for acknowledgment (e.g., "👀"). Empty = disabled. */
    emoji?: string;
    /** Send reactions in direct chats. Default: true. */
    direct?: boolean;
    /**
     * Send reactions in group chats:
     * - "always": react to all group messages
     * - "mentions": react only when bot is mentioned
     * - "never": never react in groups
     * Default: "mentions"
     */
    group?: "always" | "mentions" | "never";
  };
  /** Debounce window (ms) for batching rapid consecutive messages from the same sender (0 to disable). */
  debounceMs?: number;
  /** Heartbeat visibility settings for this account. */
  heartbeat?: ChannelHeartbeatVisibilityConfig;
};
