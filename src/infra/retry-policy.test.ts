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

import { afterEach, describe, expect, it, vi } from "vitest";

import { createTelegramRetryRunner } from "./retry-policy.js";

describe("createTelegramRetryRunner", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries when custom shouldRetry matches non-telegram error", async () => {
    vi.useFakeTimers();
    const runner = createTelegramRetryRunner({
      retry: { attempts: 2, minDelayMs: 0, maxDelayMs: 0, jitter: 0 },
      shouldRetry: (err) => err instanceof Error && err.message === "boom",
    });
    const fn = vi
      .fn<[], Promise<string>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue("ok");

    const promise = runner(fn, "request");
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
