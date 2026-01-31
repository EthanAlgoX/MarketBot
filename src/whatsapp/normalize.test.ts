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

import { isWhatsAppGroupJid, isWhatsAppUserTarget, normalizeWhatsAppTarget } from "./normalize.js";

describe("normalizeWhatsAppTarget", () => {
  it("preserves group JIDs", () => {
    expect(normalizeWhatsAppTarget("120363401234567890@g.us")).toBe("120363401234567890@g.us");
    expect(normalizeWhatsAppTarget("123456789-987654321@g.us")).toBe("123456789-987654321@g.us");
    expect(normalizeWhatsAppTarget("whatsapp:120363401234567890@g.us")).toBe(
      "120363401234567890@g.us",
    );
  });

  it("normalizes direct JIDs to E.164", () => {
    expect(normalizeWhatsAppTarget("1555123@s.whatsapp.net")).toBe("+1555123");
  });

  it("normalizes user JIDs with device suffix to E.164", () => {
    // This is the bug fix: JIDs like "41796666864:0@s.whatsapp.net" should
    // normalize to "+41796666864", not "+417966668640" (extra digit from ":0")
    expect(normalizeWhatsAppTarget("41796666864:0@s.whatsapp.net")).toBe("+41796666864");
    expect(normalizeWhatsAppTarget("1234567890:123@s.whatsapp.net")).toBe("+1234567890");
    // Without device suffix still works
    expect(normalizeWhatsAppTarget("41796666864@s.whatsapp.net")).toBe("+41796666864");
  });

  it("normalizes LID JIDs to E.164", () => {
    expect(normalizeWhatsAppTarget("123456789@lid")).toBe("+123456789");
    expect(normalizeWhatsAppTarget("123456789@LID")).toBe("+123456789");
  });

  it("rejects invalid targets", () => {
    expect(normalizeWhatsAppTarget("wat")).toBeNull();
    expect(normalizeWhatsAppTarget("whatsapp:")).toBeNull();
    expect(normalizeWhatsAppTarget("@g.us")).toBeNull();
    expect(normalizeWhatsAppTarget("whatsapp:group:@g.us")).toBeNull();
    expect(normalizeWhatsAppTarget("whatsapp:group:120363401234567890@g.us")).toBeNull();
    expect(normalizeWhatsAppTarget("group:123456789-987654321@g.us")).toBeNull();
    expect(normalizeWhatsAppTarget(" WhatsApp:Group:123456789-987654321@G.US ")).toBeNull();
    expect(normalizeWhatsAppTarget("abc@s.whatsapp.net")).toBeNull();
  });

  it("handles repeated prefixes", () => {
    expect(normalizeWhatsAppTarget("whatsapp:whatsapp:+1555")).toBe("+1555");
    expect(normalizeWhatsAppTarget("group:group:120@g.us")).toBeNull();
  });
});

describe("isWhatsAppUserTarget", () => {
  it("detects user JIDs with various formats", () => {
    expect(isWhatsAppUserTarget("41796666864:0@s.whatsapp.net")).toBe(true);
    expect(isWhatsAppUserTarget("1234567890@s.whatsapp.net")).toBe(true);
    expect(isWhatsAppUserTarget("123456789@lid")).toBe(true);
    expect(isWhatsAppUserTarget("123456789@LID")).toBe(true);
    expect(isWhatsAppUserTarget("123@lid:0")).toBe(false);
    expect(isWhatsAppUserTarget("abc@s.whatsapp.net")).toBe(false);
    expect(isWhatsAppUserTarget("123456789-987654321@g.us")).toBe(false);
    expect(isWhatsAppUserTarget("+1555123")).toBe(false);
  });
});

describe("isWhatsAppGroupJid", () => {
  it("detects group JIDs with or without prefixes", () => {
    expect(isWhatsAppGroupJid("120363401234567890@g.us")).toBe(true);
    expect(isWhatsAppGroupJid("123456789-987654321@g.us")).toBe(true);
    expect(isWhatsAppGroupJid("whatsapp:120363401234567890@g.us")).toBe(true);
    expect(isWhatsAppGroupJid("whatsapp:group:120363401234567890@g.us")).toBe(false);
    expect(isWhatsAppGroupJid("x@g.us")).toBe(false);
    expect(isWhatsAppGroupJid("@g.us")).toBe(false);
    expect(isWhatsAppGroupJid("120@g.usx")).toBe(false);
    expect(isWhatsAppGroupJid("+1555123")).toBe(false);
  });
});
