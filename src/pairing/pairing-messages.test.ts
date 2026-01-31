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

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildPairingReply } from "./pairing-messages.js";

describe("buildPairingReply", () => {
  let previousProfile: string | undefined;

  beforeEach(() => {
    previousProfile = process.env.MARKETBOT_PROFILE;
    process.env.MARKETBOT_PROFILE = "isolated";
  });

  afterEach(() => {
    if (previousProfile === undefined) {
      delete process.env.MARKETBOT_PROFILE;
      return;
    }
    process.env.MARKETBOT_PROFILE = previousProfile;
  });

  const cases = [
    {
      channel: "discord",
      idLine: "Your Discord user id: 1",
      code: "ABC123",
    },
    {
      channel: "slack",
      idLine: "Your Slack user id: U1",
      code: "DEF456",
    },
    {
      channel: "signal",
      idLine: "Your Signal number: +15550001111",
      code: "GHI789",
    },
    {
      channel: "imessage",
      idLine: "Your iMessage sender id: +15550002222",
      code: "JKL012",
    },
    {
      channel: "whatsapp",
      idLine: "Your WhatsApp phone number: +15550003333",
      code: "MNO345",
    },
  ] as const;

  for (const testCase of cases) {
    it(`formats pairing reply for ${testCase.channel}`, () => {
      const text = buildPairingReply(testCase);
      expect(text).toContain(testCase.idLine);
      expect(text).toContain(`Pairing code: ${testCase.code}`);
      // CLI commands should respect MARKETBOT_PROFILE when set (most tests run with isolated profile)
      const commandRe = new RegExp(
        `(?:marketbot|marketbot) --profile isolated pairing approve ${testCase.channel} <code>`,
      );
      expect(text).toMatch(commandRe);
    });
  }
});
