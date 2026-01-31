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

import { stripRedundantSubsystemPrefixForConsole } from "../logging.js";

describe("stripRedundantSubsystemPrefixForConsole", () => {
  it("drops '<subsystem>:' prefix", () => {
    expect(stripRedundantSubsystemPrefixForConsole("discord: hello", "discord")).toBe("hello");
  });

  it("drops '<Subsystem>:' prefix case-insensitively", () => {
    expect(stripRedundantSubsystemPrefixForConsole("WhatsApp: hello", "whatsapp")).toBe("hello");
  });

  it("drops '<subsystem> ' prefix", () => {
    expect(stripRedundantSubsystemPrefixForConsole("discord gateway: closed", "discord")).toBe(
      "gateway: closed",
    );
  });

  it("drops '[subsystem]' prefix", () => {
    expect(stripRedundantSubsystemPrefixForConsole("[discord] connection stalled", "discord")).toBe(
      "connection stalled",
    );
  });

  it("keeps messages that do not start with the subsystem", () => {
    expect(stripRedundantSubsystemPrefixForConsole("discordant: hello", "discord")).toBe(
      "discordant: hello",
    );
  });
});
