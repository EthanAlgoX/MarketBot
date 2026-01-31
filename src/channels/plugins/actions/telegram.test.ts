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

import type { MarketBotConfig } from "../../../config/config.js";
import { telegramMessageActions } from "./telegram.js";

const handleTelegramAction = vi.fn(async () => ({ ok: true }));

vi.mock("../../../agents/tools/telegram-actions.js", () => ({
  handleTelegramAction: (...args: unknown[]) => handleTelegramAction(...args),
}));

describe("telegramMessageActions", () => {
  it("excludes sticker actions when not enabled", () => {
    const cfg = { channels: { telegram: { botToken: "tok" } } } as MarketBotConfig;
    const actions = telegramMessageActions.listActions({ cfg });
    expect(actions).not.toContain("sticker");
    expect(actions).not.toContain("sticker-search");
  });

  it("allows media-only sends and passes asVoice", async () => {
    handleTelegramAction.mockClear();
    const cfg = { channels: { telegram: { botToken: "tok" } } } as MarketBotConfig;

    await telegramMessageActions.handleAction({
      action: "send",
      params: {
        to: "123",
        media: "https://example.com/voice.ogg",
        asVoice: true,
      },
      cfg,
      accountId: undefined,
    });

    expect(handleTelegramAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "sendMessage",
        to: "123",
        content: "",
        mediaUrl: "https://example.com/voice.ogg",
        asVoice: true,
      }),
      cfg,
    );
  });

  it("passes silent flag for silent sends", async () => {
    handleTelegramAction.mockClear();
    const cfg = { channels: { telegram: { botToken: "tok" } } } as MarketBotConfig;

    await telegramMessageActions.handleAction({
      action: "send",
      params: {
        to: "456",
        message: "Silent notification test",
        silent: true,
      },
      cfg,
      accountId: undefined,
    });

    expect(handleTelegramAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "sendMessage",
        to: "456",
        content: "Silent notification test",
        silent: true,
      }),
      cfg,
    );
  });

  it("maps edit action params into editMessage", async () => {
    handleTelegramAction.mockClear();
    const cfg = { channels: { telegram: { botToken: "tok" } } } as MarketBotConfig;

    await telegramMessageActions.handleAction({
      action: "edit",
      params: {
        chatId: "123",
        messageId: 42,
        message: "Updated",
        buttons: [],
      },
      cfg,
      accountId: undefined,
    });

    expect(handleTelegramAction).toHaveBeenCalledWith(
      {
        action: "editMessage",
        chatId: "123",
        messageId: 42,
        content: "Updated",
        buttons: [],
        accountId: undefined,
      },
      cfg,
    );
  });

  it("rejects non-integer messageId for edit before reaching telegram-actions", async () => {
    handleTelegramAction.mockClear();
    const cfg = { channels: { telegram: { botToken: "tok" } } } as MarketBotConfig;

    await expect(
      telegramMessageActions.handleAction({
        action: "edit",
        params: {
          chatId: "123",
          messageId: "nope",
          message: "Updated",
        },
        cfg,
        accountId: undefined,
      }),
    ).rejects.toThrow();

    expect(handleTelegramAction).not.toHaveBeenCalled();
  });

  it("accepts numeric messageId and channelId for reactions", async () => {
    handleTelegramAction.mockClear();
    const cfg = { channels: { telegram: { botToken: "tok" } } } as MarketBotConfig;

    await telegramMessageActions.handleAction({
      action: "react",
      params: {
        channelId: 123,
        messageId: 456,
        emoji: "ok",
      },
      cfg,
      accountId: undefined,
    });

    expect(handleTelegramAction).toHaveBeenCalledTimes(1);
    const call = handleTelegramAction.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.action).toBe("react");
    expect(String(call.chatId)).toBe("123");
    expect(String(call.messageId)).toBe("456");
    expect(call.emoji).toBe("ok");
  });
});
