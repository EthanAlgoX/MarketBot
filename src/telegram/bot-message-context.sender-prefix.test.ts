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

import { describe, expect, it, vi } from "vitest";

import { buildTelegramMessageContext } from "./bot-message-context.js";

describe("buildTelegramMessageContext sender prefix", () => {
  it("prefixes group bodies with sender label", async () => {
    const ctx = await buildTelegramMessageContext({
      primaryCtx: {
        message: {
          message_id: 1,
          chat: { id: -99, type: "supergroup", title: "Dev Chat" },
          date: 1700000000,
          text: "hello",
          from: { id: 42, first_name: "Alice" },
        },
        me: { id: 7, username: "bot" },
      } as never,
      allMedia: [],
      storeAllowFrom: [],
      options: {},
      bot: {
        api: {
          sendChatAction: vi.fn(),
          setMessageReaction: vi.fn(),
        },
      } as never,
      cfg: {
        agents: { defaults: { model: "anthropic/claude-opus-4-5", workspace: "/tmp/marketbot" } },
        channels: { telegram: {} },
        messages: { groupChat: { mentionPatterns: [] } },
      } as never,
      account: { accountId: "default" } as never,
      historyLimit: 0,
      groupHistories: new Map(),
      dmPolicy: "open",
      allowFrom: [],
      groupAllowFrom: [],
      ackReactionScope: "off",
      logger: { info: vi.fn() },
      resolveGroupActivation: () => undefined,
      resolveGroupRequireMention: () => false,
      resolveTelegramGroupConfig: () => ({
        groupConfig: { requireMention: false },
        topicConfig: undefined,
      }),
    });

    expect(ctx).not.toBeNull();
    const body = ctx?.ctxPayload?.Body ?? "";
    expect(body).toContain("Alice (42): hello");
  });

  it("sets MessageSid from message_id", async () => {
    const ctx = await buildTelegramMessageContext({
      primaryCtx: {
        message: {
          message_id: 12345,
          chat: { id: -99, type: "supergroup", title: "Dev Chat" },
          date: 1700000000,
          text: "hello",
          from: { id: 42, first_name: "Alice" },
        },
        me: { id: 7, username: "bot" },
      } as never,
      allMedia: [],
      storeAllowFrom: [],
      options: {},
      bot: {
        api: {
          sendChatAction: vi.fn(),
          setMessageReaction: vi.fn(),
        },
      } as never,
      cfg: {
        agents: { defaults: { model: "anthropic/claude-opus-4-5", workspace: "/tmp/marketbot" } },
        channels: { telegram: {} },
        messages: { groupChat: { mentionPatterns: [] } },
      } as never,
      account: { accountId: "default" } as never,
      historyLimit: 0,
      groupHistories: new Map(),
      dmPolicy: "open",
      allowFrom: [],
      groupAllowFrom: [],
      ackReactionScope: "off",
      logger: { info: vi.fn() },
      resolveGroupActivation: () => undefined,
      resolveGroupRequireMention: () => false,
      resolveTelegramGroupConfig: () => ({
        groupConfig: { requireMention: false },
        topicConfig: undefined,
      }),
    });

    expect(ctx).not.toBeNull();
    expect(ctx?.ctxPayload?.MessageSid).toBe("12345");
  });

  it("respects messageIdOverride option", async () => {
    const ctx = await buildTelegramMessageContext({
      primaryCtx: {
        message: {
          message_id: 12345,
          chat: { id: -99, type: "supergroup", title: "Dev Chat" },
          date: 1700000000,
          text: "hello",
          from: { id: 42, first_name: "Alice" },
        },
        me: { id: 7, username: "bot" },
      } as never,
      allMedia: [],
      storeAllowFrom: [],
      options: { messageIdOverride: "67890" },
      bot: {
        api: {
          sendChatAction: vi.fn(),
          setMessageReaction: vi.fn(),
        },
      } as never,
      cfg: {
        agents: { defaults: { model: "anthropic/claude-opus-4-5", workspace: "/tmp/marketbot" } },
        channels: { telegram: {} },
        messages: { groupChat: { mentionPatterns: [] } },
      } as never,
      account: { accountId: "default" } as never,
      historyLimit: 0,
      groupHistories: new Map(),
      dmPolicy: "open",
      allowFrom: [],
      groupAllowFrom: [],
      ackReactionScope: "off",
      logger: { info: vi.fn() },
      resolveGroupActivation: () => undefined,
      resolveGroupRequireMention: () => false,
      resolveTelegramGroupConfig: () => ({
        groupConfig: { requireMention: false },
        topicConfig: undefined,
      }),
    });

    expect(ctx).not.toBeNull();
    expect(ctx?.ctxPayload?.MessageSid).toBe("67890");
  });
});
