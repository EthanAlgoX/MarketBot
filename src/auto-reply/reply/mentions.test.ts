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
import { matchesMentionWithExplicit } from "./mentions.js";

describe("matchesMentionWithExplicit", () => {
  const mentionRegexes = [/\bmarketbot\b/i];

  it("checks mentionPatterns even when explicit mention is available", () => {
    const result = matchesMentionWithExplicit({
      text: "@marketbot hello",
      mentionRegexes,
      explicit: {
        hasAnyMention: true,
        isExplicitlyMentioned: false,
        canResolveExplicit: true,
      },
    });
    expect(result).toBe(true);
  });

  it("returns false when explicit is false and no regex match", () => {
    const result = matchesMentionWithExplicit({
      text: "<@999999> hello",
      mentionRegexes,
      explicit: {
        hasAnyMention: true,
        isExplicitlyMentioned: false,
        canResolveExplicit: true,
      },
    });
    expect(result).toBe(false);
  });

  it("returns true when explicitly mentioned even if regexes do not match", () => {
    const result = matchesMentionWithExplicit({
      text: "<@123456>",
      mentionRegexes: [],
      explicit: {
        hasAnyMention: true,
        isExplicitlyMentioned: true,
        canResolveExplicit: true,
      },
    });
    expect(result).toBe(true);
  });

  it("falls back to regex matching when explicit mention cannot be resolved", () => {
    const result = matchesMentionWithExplicit({
      text: "marketbot please",
      mentionRegexes,
      explicit: {
        hasAnyMention: true,
        isExplicitlyMentioned: false,
        canResolveExplicit: false,
      },
    });
    expect(result).toBe(true);
  });
});
