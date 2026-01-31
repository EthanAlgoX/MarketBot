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

import { describe, expect, it, vi } from "vitest";

import { waitForTransportReady } from "./transport-ready.js";

describe("waitForTransportReady", () => {
  it("returns when the check succeeds and logs after the delay", async () => {
    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };
    let attempts = 0;
    await waitForTransportReady({
      label: "test transport",
      timeoutMs: 500,
      logAfterMs: 120,
      logIntervalMs: 100,
      pollIntervalMs: 80,
      runtime,
      check: async () => {
        attempts += 1;
        if (attempts > 4) {
          return { ok: true };
        }
        return { ok: false, error: "not ready" };
      },
    });
    expect(runtime.error).toHaveBeenCalled();
  });

  it("throws after the timeout", async () => {
    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };
    await expect(
      waitForTransportReady({
        label: "test transport",
        timeoutMs: 200,
        logAfterMs: 0,
        logIntervalMs: 100,
        pollIntervalMs: 50,
        runtime,
        check: async () => ({ ok: false, error: "still down" }),
      }),
    ).rejects.toThrow("test transport not ready");
    expect(runtime.error).toHaveBeenCalled();
  });

  it("returns early when aborted", async () => {
    const runtime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };
    const controller = new AbortController();
    controller.abort();
    await waitForTransportReady({
      label: "test transport",
      timeoutMs: 200,
      runtime,
      abortSignal: controller.signal,
      check: async () => ({ ok: false, error: "still down" }),
    });
    expect(runtime.error).not.toHaveBeenCalled();
  });
});
