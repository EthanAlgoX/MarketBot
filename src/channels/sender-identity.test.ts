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

import type { MsgContext } from "../auto-reply/templating.js";
import { validateSenderIdentity } from "./sender-identity.js";

describe("validateSenderIdentity", () => {
  it("allows direct messages without sender fields", () => {
    const ctx: MsgContext = { ChatType: "direct" };
    expect(validateSenderIdentity(ctx)).toEqual([]);
  });

  it("requires some sender identity for non-direct chats", () => {
    const ctx: MsgContext = { ChatType: "group" };
    expect(validateSenderIdentity(ctx)).toContain(
      "missing sender identity (SenderId/SenderName/SenderUsername/SenderE164)",
    );
  });

  it("validates SenderE164 and SenderUsername shape", () => {
    const ctx: MsgContext = {
      ChatType: "group",
      SenderE164: "123",
      SenderUsername: "@ada lovelace",
    };
    expect(validateSenderIdentity(ctx)).toEqual([
      "invalid SenderE164: 123",
      'SenderUsername should not include "@": @ada lovelace',
      "SenderUsername should not include whitespace: @ada lovelace",
    ]);
  });
});
