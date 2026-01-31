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

import {
  buildOutboundDeliveryJson,
  formatGatewaySummary,
  formatOutboundDeliverySummary,
} from "./format.js";

describe("formatOutboundDeliverySummary", () => {
  it("falls back when result is missing", () => {
    expect(formatOutboundDeliverySummary("telegram")).toBe(
      "✅ Sent via Telegram. Message ID: unknown",
    );
    expect(formatOutboundDeliverySummary("imessage")).toBe(
      "✅ Sent via iMessage. Message ID: unknown",
    );
  });

  it("adds chat or channel details", () => {
    expect(
      formatOutboundDeliverySummary("telegram", {
        channel: "telegram",
        messageId: "m1",
        chatId: "c1",
      }),
    ).toBe("✅ Sent via Telegram. Message ID: m1 (chat c1)");

    expect(
      formatOutboundDeliverySummary("discord", {
        channel: "discord",
        messageId: "d1",
        channelId: "chan",
      }),
    ).toBe("✅ Sent via Discord. Message ID: d1 (channel chan)");
  });
});

describe("buildOutboundDeliveryJson", () => {
  it("builds direct delivery payloads", () => {
    expect(
      buildOutboundDeliveryJson({
        channel: "telegram",
        to: "123",
        result: { channel: "telegram", messageId: "m1", chatId: "c1" },
        mediaUrl: "https://example.com/a.png",
      }),
    ).toEqual({
      channel: "telegram",
      via: "direct",
      to: "123",
      messageId: "m1",
      mediaUrl: "https://example.com/a.png",
      chatId: "c1",
    });
  });

  it("supports whatsapp metadata when present", () => {
    expect(
      buildOutboundDeliveryJson({
        channel: "whatsapp",
        to: "+1",
        result: { channel: "whatsapp", messageId: "w1", toJid: "jid" },
      }),
    ).toEqual({
      channel: "whatsapp",
      via: "direct",
      to: "+1",
      messageId: "w1",
      mediaUrl: null,
      toJid: "jid",
    });
  });

  it("keeps timestamp for signal", () => {
    expect(
      buildOutboundDeliveryJson({
        channel: "signal",
        to: "+1",
        result: { channel: "signal", messageId: "s1", timestamp: 123 },
      }),
    ).toEqual({
      channel: "signal",
      via: "direct",
      to: "+1",
      messageId: "s1",
      mediaUrl: null,
      timestamp: 123,
    });
  });
});

describe("formatGatewaySummary", () => {
  it("formats gateway summaries with channel", () => {
    expect(formatGatewaySummary({ channel: "whatsapp", messageId: "m1" })).toBe(
      "✅ Sent via gateway (whatsapp). Message ID: m1",
    );
  });

  it("supports custom actions", () => {
    expect(
      formatGatewaySummary({
        action: "Poll sent",
        channel: "discord",
        messageId: "p1",
      }),
    ).toBe("✅ Poll sent via gateway (discord). Message ID: p1");
  });
});
