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

import { describe, expect, test } from "vitest";
import { formatForLog, shortId, summarizeAgentEventForWsLog } from "./ws-log.js";

describe("gateway ws log helpers", () => {
  test("shortId compacts uuids and long strings", () => {
    expect(shortId("12345678-1234-1234-1234-123456789abc")).toBe("12345678…9abc");
    expect(shortId("a".repeat(30))).toBe("aaaaaaaaaaaa…aaaa");
    expect(shortId("short")).toBe("short");
  });

  test("formatForLog formats errors and messages", () => {
    const err = new Error("boom");
    err.name = "TestError";
    expect(formatForLog(err)).toContain("TestError");
    expect(formatForLog(err)).toContain("boom");

    const obj = { name: "Oops", message: "failed", code: "E1" };
    expect(formatForLog(obj)).toBe("Oops: failed: code=E1");
  });

  test("formatForLog redacts obvious secrets", () => {
    const token = "sk-abcdefghijklmnopqrstuvwxyz123456";
    const out = formatForLog({ token });
    expect(out).toContain("token");
    expect(out).not.toContain(token);
    expect(out).toContain("…");
  });

  test("summarizeAgentEventForWsLog extracts useful fields", () => {
    const summary = summarizeAgentEventForWsLog({
      runId: "12345678-1234-1234-1234-123456789abc",
      sessionKey: "agent:main:main",
      stream: "assistant",
      seq: 2,
      data: { text: "hello world", mediaUrls: ["a", "b"] },
    });
    expect(summary).toMatchObject({
      agent: "main",
      run: "12345678…9abc",
      session: "main",
      stream: "assistant",
      aseq: 2,
      text: "hello world",
      media: 2,
    });

    const tool = summarizeAgentEventForWsLog({
      runId: "run-1",
      stream: "tool",
      data: { phase: "start", name: "fetch", toolCallId: "call-1" },
    });
    expect(tool).toMatchObject({
      stream: "tool",
      tool: "start:fetch",
      call: "call-1",
    });
  });
});
