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

import { deliverLineAutoReply } from "./auto-reply-delivery.js";
import { sendLineReplyChunks } from "./reply-chunks.js";

const createFlexMessage = (altText: string, contents: unknown) => ({
  type: "flex" as const,
  altText,
  contents,
});

const createImageMessage = (url: string) => ({
  type: "image" as const,
  originalContentUrl: url,
  previewImageUrl: url,
});

const createLocationMessage = (location: {
  title: string;
  address: string;
  latitude: number;
  longitude: number;
}) => ({
  type: "location" as const,
  ...location,
});

describe("deliverLineAutoReply", () => {
  it("uses reply token for text before sending rich messages", async () => {
    const replyMessageLine = vi.fn(async () => ({}));
    const pushMessageLine = vi.fn(async () => ({}));
    const pushTextMessageWithQuickReplies = vi.fn(async () => ({}));
    const createTextMessageWithQuickReplies = vi.fn((text: string) => ({
      type: "text" as const,
      text,
    }));
    const createQuickReplyItems = vi.fn((labels: string[]) => ({ items: labels }));
    const pushMessagesLine = vi.fn(async () => ({ messageId: "push", chatId: "u1" }));

    const lineData = {
      flexMessage: { altText: "Card", contents: { type: "bubble" } },
    };

    const result = await deliverLineAutoReply({
      payload: { text: "hello", channelData: { line: lineData } },
      lineData,
      to: "line:user:1",
      replyToken: "token",
      replyTokenUsed: false,
      accountId: "acc",
      textLimit: 5000,
      deps: {
        buildTemplateMessageFromPayload: () => null,
        processLineMessage: (text) => ({ text, flexMessages: [] }),
        chunkMarkdownText: (text) => [text],
        sendLineReplyChunks,
        replyMessageLine,
        pushMessageLine,
        pushTextMessageWithQuickReplies,
        createTextMessageWithQuickReplies,
        createQuickReplyItems,
        pushMessagesLine,
        createFlexMessage,
        createImageMessage,
        createLocationMessage,
      },
    });

    expect(result.replyTokenUsed).toBe(true);
    expect(replyMessageLine).toHaveBeenCalledTimes(1);
    expect(replyMessageLine).toHaveBeenCalledWith("token", [{ type: "text", text: "hello" }], {
      accountId: "acc",
    });
    expect(pushMessagesLine).toHaveBeenCalledTimes(1);
    expect(pushMessagesLine).toHaveBeenCalledWith(
      "line:user:1",
      [createFlexMessage("Card", { type: "bubble" })],
      { accountId: "acc" },
    );
    expect(createQuickReplyItems).not.toHaveBeenCalled();
  });

  it("uses reply token for rich-only payloads", async () => {
    const replyMessageLine = vi.fn(async () => ({}));
    const pushMessageLine = vi.fn(async () => ({}));
    const pushTextMessageWithQuickReplies = vi.fn(async () => ({}));
    const createTextMessageWithQuickReplies = vi.fn((text: string) => ({
      type: "text" as const,
      text,
    }));
    const createQuickReplyItems = vi.fn((labels: string[]) => ({ items: labels }));
    const pushMessagesLine = vi.fn(async () => ({ messageId: "push", chatId: "u1" }));

    const lineData = {
      flexMessage: { altText: "Card", contents: { type: "bubble" } },
      quickReplies: ["A"],
    };

    const result = await deliverLineAutoReply({
      payload: { channelData: { line: lineData } },
      lineData,
      to: "line:user:1",
      replyToken: "token",
      replyTokenUsed: false,
      accountId: "acc",
      textLimit: 5000,
      deps: {
        buildTemplateMessageFromPayload: () => null,
        processLineMessage: () => ({ text: "", flexMessages: [] }),
        chunkMarkdownText: () => [],
        sendLineReplyChunks: vi.fn(async () => ({ replyTokenUsed: false })),
        replyMessageLine,
        pushMessageLine,
        pushTextMessageWithQuickReplies,
        createTextMessageWithQuickReplies,
        createQuickReplyItems,
        pushMessagesLine,
        createFlexMessage,
        createImageMessage,
        createLocationMessage,
      },
    });

    expect(result.replyTokenUsed).toBe(true);
    expect(replyMessageLine).toHaveBeenCalledTimes(1);
    expect(replyMessageLine).toHaveBeenCalledWith(
      "token",
      [
        {
          ...createFlexMessage("Card", { type: "bubble" }),
          quickReply: { items: ["A"] },
        },
      ],
      { accountId: "acc" },
    );
    expect(pushMessagesLine).not.toHaveBeenCalled();
    expect(createQuickReplyItems).toHaveBeenCalledWith(["A"]);
  });

  it("sends rich messages before quick-reply text so quick replies remain visible", async () => {
    const replyMessageLine = vi.fn(async () => ({}));
    const pushMessageLine = vi.fn(async () => ({}));
    const pushTextMessageWithQuickReplies = vi.fn(async () => ({}));
    const createTextMessageWithQuickReplies = vi.fn((text: string, _quickReplies: string[]) => ({
      type: "text" as const,
      text,
      quickReply: { items: ["A"] },
    }));
    const createQuickReplyItems = vi.fn((labels: string[]) => ({ items: labels }));
    const pushMessagesLine = vi.fn(async () => ({ messageId: "push", chatId: "u1" }));

    const lineData = {
      flexMessage: { altText: "Card", contents: { type: "bubble" } },
      quickReplies: ["A"],
    };

    await deliverLineAutoReply({
      payload: { text: "hello", channelData: { line: lineData } },
      lineData,
      to: "line:user:1",
      replyToken: "token",
      replyTokenUsed: false,
      accountId: "acc",
      textLimit: 5000,
      deps: {
        buildTemplateMessageFromPayload: () => null,
        processLineMessage: (text) => ({ text, flexMessages: [] }),
        chunkMarkdownText: (text) => [text],
        sendLineReplyChunks,
        replyMessageLine,
        pushMessageLine,
        pushTextMessageWithQuickReplies,
        createTextMessageWithQuickReplies,
        createQuickReplyItems,
        pushMessagesLine,
        createFlexMessage,
        createImageMessage,
        createLocationMessage,
      },
    });

    expect(pushMessagesLine).toHaveBeenCalledWith(
      "line:user:1",
      [createFlexMessage("Card", { type: "bubble" })],
      { accountId: "acc" },
    );
    expect(replyMessageLine).toHaveBeenCalledWith(
      "token",
      [
        {
          type: "text",
          text: "hello",
          quickReply: { items: ["A"] },
        },
      ],
      { accountId: "acc" },
    );
    const pushOrder = pushMessagesLine.mock.invocationCallOrder[0];
    const replyOrder = replyMessageLine.mock.invocationCallOrder[0];
    expect(pushOrder).toBeLessThan(replyOrder);
  });
});
