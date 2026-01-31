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

import { buildWaitingStatusMessage, pickWaitingPhrase } from "./tui-waiting.js";

const theme = {
  dim: (s: string) => `<d>${s}</d>`,
  bold: (s: string) => `<b>${s}</b>`,
  accentSoft: (s: string) => `<a>${s}</a>`,
} as any;

describe("tui-waiting", () => {
  it("pickWaitingPhrase rotates every 10 ticks", () => {
    const phrases = ["a", "b", "c"];
    expect(pickWaitingPhrase(0, phrases)).toBe("a");
    expect(pickWaitingPhrase(9, phrases)).toBe("a");
    expect(pickWaitingPhrase(10, phrases)).toBe("b");
    expect(pickWaitingPhrase(20, phrases)).toBe("c");
    expect(pickWaitingPhrase(30, phrases)).toBe("a");
  });

  it("buildWaitingStatusMessage includes shimmer markup and metadata", () => {
    const msg = buildWaitingStatusMessage({
      theme,
      tick: 1,
      elapsed: "3s",
      connectionStatus: "connected",
      phrases: ["hello"],
    });

    expect(msg).toContain("connected");
    expect(msg).toContain("3s");
    // text is wrapped per-char; check it appears in order
    expect(msg).toContain("h");
    expect(msg).toContain("e");
    expect(msg).toContain("l");
    expect(msg).toContain("o");
    // shimmer should contain both highlighted and dim parts
    expect(msg).toContain("<b><a>");
    expect(msg).toContain("<d>");
  });
});
