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

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  consumeRestartSentinel,
  readRestartSentinel,
  resolveRestartSentinelPath,
  trimLogTail,
  writeRestartSentinel,
} from "./restart-sentinel.js";

describe("restart sentinel", () => {
  let prevStateDir: string | undefined;
  let tempDir: string;

  beforeEach(async () => {
    prevStateDir = process.env.MARKETBOT_STATE_DIR;
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-sentinel-"));
    process.env.MARKETBOT_STATE_DIR = tempDir;
  });

  afterEach(async () => {
    if (prevStateDir) {
      process.env.MARKETBOT_STATE_DIR = prevStateDir;
    } else {
      delete process.env.MARKETBOT_STATE_DIR;
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("writes and consumes a sentinel", async () => {
    const payload = {
      kind: "update" as const,
      status: "ok" as const,
      ts: Date.now(),
      sessionKey: "agent:main:whatsapp:dm:+15555550123",
      stats: { mode: "git" },
    };
    const filePath = await writeRestartSentinel(payload);
    expect(filePath).toBe(resolveRestartSentinelPath());

    const read = await readRestartSentinel();
    expect(read?.payload.kind).toBe("update");

    const consumed = await consumeRestartSentinel();
    expect(consumed?.payload.sessionKey).toBe(payload.sessionKey);

    const empty = await readRestartSentinel();
    expect(empty).toBeNull();
  });

  it("drops invalid sentinel payloads", async () => {
    const filePath = resolveRestartSentinelPath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, "not-json", "utf-8");

    const read = await readRestartSentinel();
    expect(read).toBeNull();

    await expect(fs.stat(filePath)).rejects.toThrow();
  });

  it("trims log tails", () => {
    const text = "a".repeat(9000);
    const trimmed = trimLogTail(text, 8000);
    expect(trimmed?.length).toBeLessThanOrEqual(8001);
    expect(trimmed?.startsWith("…")).toBe(true);
  });
});
