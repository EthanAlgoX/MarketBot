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

import {
  buildSlackSlashCommandMatcher,
  isSlackChannelAllowedByPolicy,
  resolveSlackThreadTs,
} from "./monitor.js";

describe("slack groupPolicy gating", () => {
  it("allows when policy is open", () => {
    expect(
      isSlackChannelAllowedByPolicy({
        groupPolicy: "open",
        channelAllowlistConfigured: false,
        channelAllowed: false,
      }),
    ).toBe(true);
  });

  it("blocks when policy is disabled", () => {
    expect(
      isSlackChannelAllowedByPolicy({
        groupPolicy: "disabled",
        channelAllowlistConfigured: true,
        channelAllowed: true,
      }),
    ).toBe(false);
  });

  it("blocks allowlist when no channel allowlist configured", () => {
    expect(
      isSlackChannelAllowedByPolicy({
        groupPolicy: "allowlist",
        channelAllowlistConfigured: false,
        channelAllowed: true,
      }),
    ).toBe(false);
  });

  it("allows allowlist when channel is allowed", () => {
    expect(
      isSlackChannelAllowedByPolicy({
        groupPolicy: "allowlist",
        channelAllowlistConfigured: true,
        channelAllowed: true,
      }),
    ).toBe(true);
  });

  it("blocks allowlist when channel is not allowed", () => {
    expect(
      isSlackChannelAllowedByPolicy({
        groupPolicy: "allowlist",
        channelAllowlistConfigured: true,
        channelAllowed: false,
      }),
    ).toBe(false);
  });
});

describe("resolveSlackThreadTs", () => {
  const threadTs = "1234567890.123456";
  const messageTs = "9999999999.999999";

  describe("replyToMode=off", () => {
    it("returns incomingThreadTs when in a thread", () => {
      expect(
        resolveSlackThreadTs({
          replyToMode: "off",
          incomingThreadTs: threadTs,
          messageTs,
          hasReplied: false,
        }),
      ).toBe(threadTs);
    });

    it("returns incomingThreadTs even after replies (stays in thread)", () => {
      expect(
        resolveSlackThreadTs({
          replyToMode: "off",
          incomingThreadTs: threadTs,
          messageTs,
          hasReplied: true,
        }),
      ).toBe(threadTs);
    });

    it("returns undefined when not in a thread", () => {
      expect(
        resolveSlackThreadTs({
          replyToMode: "off",
          incomingThreadTs: undefined,
          messageTs,
          hasReplied: false,
        }),
      ).toBeUndefined();
    });
  });

  describe("replyToMode=first", () => {
    it("returns incomingThreadTs when in a thread (always stays threaded)", () => {
      expect(
        resolveSlackThreadTs({
          replyToMode: "first",
          incomingThreadTs: threadTs,
          messageTs,
          hasReplied: false,
        }),
      ).toBe(threadTs);
    });

    it("returns messageTs for first reply when not in a thread", () => {
      expect(
        resolveSlackThreadTs({
          replyToMode: "first",
          incomingThreadTs: undefined,
          messageTs,
          hasReplied: false,
        }),
      ).toBe(messageTs);
    });

    it("returns undefined for subsequent replies when not in a thread (goes to main channel)", () => {
      expect(
        resolveSlackThreadTs({
          replyToMode: "first",
          incomingThreadTs: undefined,
          messageTs,
          hasReplied: true,
        }),
      ).toBeUndefined();
    });
  });

  describe("replyToMode=all", () => {
    it("returns incomingThreadTs when in a thread", () => {
      expect(
        resolveSlackThreadTs({
          replyToMode: "all",
          incomingThreadTs: threadTs,
          messageTs,
          hasReplied: false,
        }),
      ).toBe(threadTs);
    });

    it("returns messageTs when not in a thread (starts thread)", () => {
      expect(
        resolveSlackThreadTs({
          replyToMode: "all",
          incomingThreadTs: undefined,
          messageTs,
          hasReplied: true,
        }),
      ).toBe(messageTs);
    });
  });
});

describe("buildSlackSlashCommandMatcher", () => {
  it("matches with or without a leading slash", () => {
    const matcher = buildSlackSlashCommandMatcher("marketbot");

    expect(matcher.test("marketbot")).toBe(true);
    expect(matcher.test("/marketbot")).toBe(true);
  });

  it("does not match similar names", () => {
    const matcher = buildSlackSlashCommandMatcher("marketbot");

    expect(matcher.test("/marketbot-bot")).toBe(false);
    expect(matcher.test("marketbot-bot")).toBe(false);
  });
});
