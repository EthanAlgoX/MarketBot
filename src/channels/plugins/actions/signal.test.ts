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
import { signalMessageActions } from "./signal.js";

const sendReactionSignal = vi.fn(async () => ({ ok: true }));
const removeReactionSignal = vi.fn(async () => ({ ok: true }));

vi.mock("../../../signal/send-reactions.js", () => ({
  sendReactionSignal: (...args: unknown[]) => sendReactionSignal(...args),
  removeReactionSignal: (...args: unknown[]) => removeReactionSignal(...args),
}));

describe("signalMessageActions", () => {
  it("returns no actions when no configured accounts exist", () => {
    const cfg = {} as MarketBotConfig;
    expect(signalMessageActions.listActions({ cfg })).toEqual([]);
  });

  it("hides react when reactions are disabled", () => {
    const cfg = {
      channels: { signal: { account: "+15550001111", actions: { reactions: false } } },
    } as MarketBotConfig;
    expect(signalMessageActions.listActions({ cfg })).toEqual(["send"]);
  });

  it("enables react when at least one account allows reactions", () => {
    const cfg = {
      channels: {
        signal: {
          actions: { reactions: false },
          accounts: {
            work: { account: "+15550001111", actions: { reactions: true } },
          },
        },
      },
    } as MarketBotConfig;
    expect(signalMessageActions.listActions({ cfg })).toEqual(["send", "react"]);
  });

  it("skips send for plugin dispatch", () => {
    expect(signalMessageActions.supportsAction?.({ action: "send" })).toBe(false);
    expect(signalMessageActions.supportsAction?.({ action: "react" })).toBe(true);
  });

  it("blocks reactions when action gate is disabled", async () => {
    const cfg = {
      channels: { signal: { account: "+15550001111", actions: { reactions: false } } },
    } as MarketBotConfig;

    await expect(
      signalMessageActions.handleAction({
        action: "react",
        params: { to: "+15550001111", messageId: "123", emoji: "✅" },
        cfg,
        accountId: undefined,
      }),
    ).rejects.toThrow(/actions\.reactions/);
  });

  it("uses account-level actions when enabled", async () => {
    sendReactionSignal.mockClear();
    const cfg = {
      channels: {
        signal: {
          actions: { reactions: false },
          accounts: {
            work: { account: "+15550001111", actions: { reactions: true } },
          },
        },
      },
    } as MarketBotConfig;

    await signalMessageActions.handleAction({
      action: "react",
      params: { to: "+15550001111", messageId: "123", emoji: "👍" },
      cfg,
      accountId: "work",
    });

    expect(sendReactionSignal).toHaveBeenCalledWith("+15550001111", 123, "👍", {
      accountId: "work",
    });
  });

  it("normalizes uuid recipients", async () => {
    sendReactionSignal.mockClear();
    const cfg = {
      channels: { signal: { account: "+15550001111" } },
    } as MarketBotConfig;

    await signalMessageActions.handleAction({
      action: "react",
      params: {
        recipient: "uuid:123e4567-e89b-12d3-a456-426614174000",
        messageId: "123",
        emoji: "🔥",
      },
      cfg,
      accountId: undefined,
    });

    expect(sendReactionSignal).toHaveBeenCalledWith(
      "123e4567-e89b-12d3-a456-426614174000",
      123,
      "🔥",
      { accountId: undefined },
    );
  });

  it("requires targetAuthor for group reactions", async () => {
    const cfg = {
      channels: { signal: { account: "+15550001111" } },
    } as MarketBotConfig;

    await expect(
      signalMessageActions.handleAction({
        action: "react",
        params: { to: "signal:group:group-id", messageId: "123", emoji: "✅" },
        cfg,
        accountId: undefined,
      }),
    ).rejects.toThrow(/targetAuthor/);
  });

  it("passes groupId and targetAuthor for group reactions", async () => {
    sendReactionSignal.mockClear();
    const cfg = {
      channels: { signal: { account: "+15550001111" } },
    } as MarketBotConfig;

    await signalMessageActions.handleAction({
      action: "react",
      params: {
        to: "signal:group:group-id",
        targetAuthor: "uuid:123e4567-e89b-12d3-a456-426614174000",
        messageId: "123",
        emoji: "✅",
      },
      cfg,
      accountId: undefined,
    });

    expect(sendReactionSignal).toHaveBeenCalledWith("", 123, "✅", {
      accountId: undefined,
      groupId: "group-id",
      targetAuthor: "uuid:123e4567-e89b-12d3-a456-426614174000",
      targetAuthorUuid: undefined,
    });
  });
});
