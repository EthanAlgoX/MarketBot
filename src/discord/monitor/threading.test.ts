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

import { describe, expect, it } from "vitest";
import { buildAgentSessionKey } from "../../routing/resolve-route.js";
import type { Client } from "@buape/carbon";
import {
  resolveDiscordAutoThreadContext,
  resolveDiscordAutoThreadReplyPlan,
  resolveDiscordReplyDeliveryPlan,
} from "./threading.js";

describe("resolveDiscordAutoThreadContext", () => {
  it("returns null when no createdThreadId", () => {
    expect(
      resolveDiscordAutoThreadContext({
        agentId: "agent",
        channel: "discord",
        messageChannelId: "parent",
        createdThreadId: undefined,
      }),
    ).toBeNull();
  });

  it("re-keys session context to the created thread", () => {
    const context = resolveDiscordAutoThreadContext({
      agentId: "agent",
      channel: "discord",
      messageChannelId: "parent",
      createdThreadId: "thread",
    });
    expect(context).not.toBeNull();
    expect(context?.To).toBe("channel:thread");
    expect(context?.From).toBe("discord:channel:thread");
    expect(context?.OriginatingTo).toBe("channel:thread");
    expect(context?.SessionKey).toBe(
      buildAgentSessionKey({
        agentId: "agent",
        channel: "discord",
        peer: { kind: "channel", id: "thread" },
      }),
    );
    expect(context?.ParentSessionKey).toBe(
      buildAgentSessionKey({
        agentId: "agent",
        channel: "discord",
        peer: { kind: "channel", id: "parent" },
      }),
    );
  });
});

describe("resolveDiscordReplyDeliveryPlan", () => {
  it("uses reply references when posting to the original target", () => {
    const plan = resolveDiscordReplyDeliveryPlan({
      replyTarget: "channel:parent",
      replyToMode: "all",
      messageId: "m1",
      threadChannel: null,
      createdThreadId: null,
    });
    expect(plan.deliverTarget).toBe("channel:parent");
    expect(plan.replyTarget).toBe("channel:parent");
    expect(plan.replyReference.use()).toBe("m1");
  });

  it("disables reply references when autoThread creates a new thread", () => {
    const plan = resolveDiscordReplyDeliveryPlan({
      replyTarget: "channel:parent",
      replyToMode: "all",
      messageId: "m1",
      threadChannel: null,
      createdThreadId: "thread",
    });
    expect(plan.deliverTarget).toBe("channel:thread");
    expect(plan.replyTarget).toBe("channel:thread");
    expect(plan.replyReference.use()).toBeUndefined();
  });

  it("always uses existingId when inside a thread", () => {
    const plan = resolveDiscordReplyDeliveryPlan({
      replyTarget: "channel:thread",
      replyToMode: "off",
      messageId: "m1",
      threadChannel: { id: "thread" },
      createdThreadId: null,
    });
    expect(plan.replyReference.use()).toBe("m1");
  });
});

describe("resolveDiscordAutoThreadReplyPlan", () => {
  it("switches delivery + session context to the created thread", async () => {
    const client = {
      rest: { post: async () => ({ id: "thread" }) },
    } as unknown as Client;
    const plan = await resolveDiscordAutoThreadReplyPlan({
      client,
      message: {
        id: "m1",
        channelId: "parent",
      } as unknown as import("./listeners.js").DiscordMessageEvent["message"],
      isGuildMessage: true,
      channelConfig: {
        autoThread: true,
      } as unknown as import("./allow-list.js").DiscordChannelConfigResolved,
      threadChannel: null,
      baseText: "hello",
      combinedBody: "hello",
      replyToMode: "all",
      agentId: "agent",
      channel: "discord",
    });
    expect(plan.deliverTarget).toBe("channel:thread");
    expect(plan.replyReference.use()).toBeUndefined();
    expect(plan.autoThreadContext?.SessionKey).toBe(
      buildAgentSessionKey({
        agentId: "agent",
        channel: "discord",
        peer: { kind: "channel", id: "thread" },
      }),
    );
  });

  it("does nothing when autoThread is disabled", async () => {
    const client = { rest: { post: async () => ({ id: "thread" }) } } as unknown as Client;
    const plan = await resolveDiscordAutoThreadReplyPlan({
      client,
      message: {
        id: "m1",
        channelId: "parent",
      } as unknown as import("./listeners.js").DiscordMessageEvent["message"],
      isGuildMessage: true,
      channelConfig: {
        autoThread: false,
      } as unknown as import("./allow-list.js").DiscordChannelConfigResolved,
      threadChannel: null,
      baseText: "hello",
      combinedBody: "hello",
      replyToMode: "all",
      agentId: "agent",
      channel: "discord",
    });
    expect(plan.deliverTarget).toBe("channel:parent");
    expect(plan.autoThreadContext).toBeNull();
  });
});
