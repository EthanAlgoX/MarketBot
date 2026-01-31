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
import { assertWebChannel, normalizeE164, toWhatsappJid } from "./index.js";

describe("normalizeE164", () => {
  it("strips whatsapp prefix and whitespace", () => {
    expect(normalizeE164("whatsapp:+1 555 555 0123")).toBe("+15555550123");
  });

  it("adds plus when missing", () => {
    expect(normalizeE164("1555123")).toBe("+1555123");
  });
});

describe("toWhatsappJid", () => {
  it("converts E164 to jid", () => {
    expect(toWhatsappJid("+1 555 555 0123")).toBe("15555550123@s.whatsapp.net");
  });

  it("keeps group JIDs intact", () => {
    expect(toWhatsappJid("123456789-987654321@g.us")).toBe("123456789-987654321@g.us");
  });
});

describe("assertWebChannel", () => {
  it("accepts valid channels", () => {
    expect(() => assertWebChannel("web")).not.toThrow();
  });

  it("throws on invalid channel", () => {
    expect(() => assertWebChannel("invalid" as string)).toThrow();
  });
});
