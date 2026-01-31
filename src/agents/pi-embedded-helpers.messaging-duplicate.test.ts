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
import { isMessagingToolDuplicate, normalizeTextForComparison } from "./pi-embedded-helpers.js";

describe("normalizeTextForComparison", () => {
  it("lowercases text", () => {
    expect(normalizeTextForComparison("Hello World")).toBe("hello world");
  });

  it("trims whitespace", () => {
    expect(normalizeTextForComparison("  hello  ")).toBe("hello");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeTextForComparison("hello    world")).toBe("hello world");
  });

  it("strips emoji", () => {
    expect(normalizeTextForComparison("Hello 👋 World 🌍")).toBe("hello world");
  });

  it("handles mixed normalization", () => {
    expect(normalizeTextForComparison("  Hello 👋   WORLD  🌍  ")).toBe("hello world");
  });
});

describe("isMessagingToolDuplicate", () => {
  it("returns false for empty sentTexts", () => {
    expect(isMessagingToolDuplicate("hello world", [])).toBe(false);
  });

  it("returns false for short texts", () => {
    expect(isMessagingToolDuplicate("short", ["short"])).toBe(false);
  });

  it("detects exact duplicates", () => {
    expect(
      isMessagingToolDuplicate("Hello, this is a test message!", [
        "Hello, this is a test message!",
      ]),
    ).toBe(true);
  });

  it("detects duplicates with different casing", () => {
    expect(
      isMessagingToolDuplicate("HELLO, THIS IS A TEST MESSAGE!", [
        "hello, this is a test message!",
      ]),
    ).toBe(true);
  });

  it("detects duplicates with emoji variations", () => {
    expect(
      isMessagingToolDuplicate("Hello! 👋 This is a test message!", [
        "Hello! This is a test message!",
      ]),
    ).toBe(true);
  });

  it("detects substring duplicates (LLM elaboration)", () => {
    expect(
      isMessagingToolDuplicate('I sent the message: "Hello, this is a test message!"', [
        "Hello, this is a test message!",
      ]),
    ).toBe(true);
  });

  it("detects when sent text contains block reply (reverse substring)", () => {
    expect(
      isMessagingToolDuplicate("Hello, this is a test message!", [
        'I sent the message: "Hello, this is a test message!"',
      ]),
    ).toBe(true);
  });

  it("returns false for non-matching texts", () => {
    expect(
      isMessagingToolDuplicate("This is completely different content.", [
        "Hello, this is a test message!",
      ]),
    ).toBe(false);
  });
});
