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

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess } from "node:child_process";
import { describe, expect, it, vi } from "vitest";

import { spawnWithFallback } from "./spawn-utils.js";

function createStubChild() {
  const child = new EventEmitter() as ChildProcess;
  child.stdin = new PassThrough() as ChildProcess["stdin"];
  child.stdout = new PassThrough() as ChildProcess["stdout"];
  child.stderr = new PassThrough() as ChildProcess["stderr"];
  child.pid = 1234;
  child.killed = false;
  child.kill = vi.fn(() => true) as ChildProcess["kill"];
  queueMicrotask(() => {
    child.emit("spawn");
  });
  return child;
}

describe("spawnWithFallback", () => {
  it("retries on EBADF using fallback options", async () => {
    const spawnMock = vi
      .fn()
      .mockImplementationOnce(() => {
        const err = new Error("spawn EBADF");
        (err as NodeJS.ErrnoException).code = "EBADF";
        throw err;
      })
      .mockImplementationOnce(() => createStubChild());

    const result = await spawnWithFallback({
      argv: ["echo", "ok"],
      options: { stdio: ["pipe", "pipe", "pipe"] },
      fallbacks: [{ label: "safe-stdin", options: { stdio: ["ignore", "pipe", "pipe"] } }],
      spawnImpl: spawnMock,
    });

    expect(result.usedFallback).toBe(true);
    expect(result.fallbackLabel).toBe("safe-stdin");
    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(spawnMock.mock.calls[0]?.[2]?.stdio).toEqual(["pipe", "pipe", "pipe"]);
    expect(spawnMock.mock.calls[1]?.[2]?.stdio).toEqual(["ignore", "pipe", "pipe"]);
  });

  it("does not retry on non-EBADF errors", async () => {
    const spawnMock = vi.fn().mockImplementationOnce(() => {
      const err = new Error("spawn ENOENT");
      (err as NodeJS.ErrnoException).code = "ENOENT";
      throw err;
    });

    await expect(
      spawnWithFallback({
        argv: ["missing"],
        options: { stdio: ["pipe", "pipe", "pipe"] },
        fallbacks: [{ label: "safe-stdin", options: { stdio: ["ignore", "pipe", "pipe"] } }],
        spawnImpl: spawnMock,
      }),
    ).rejects.toThrow(/ENOENT/);
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
});
