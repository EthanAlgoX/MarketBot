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

import { wrapFetchWithAbortSignal } from "./fetch.js";

describe("wrapFetchWithAbortSignal", () => {
  it("adds duplex for requests with a body", async () => {
    let seenInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seenInit = init;
      return {} as Response;
    });

    const wrapped = wrapFetchWithAbortSignal(fetchImpl);

    await wrapped("https://example.com", { method: "POST", body: "hi" });

    expect(seenInit?.duplex).toBe("half");
  });

  it("converts foreign abort signals to native controllers", async () => {
    let seenSignal: AbortSignal | undefined;
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seenSignal = init?.signal as AbortSignal | undefined;
      return {} as Response;
    });

    const wrapped = wrapFetchWithAbortSignal(fetchImpl);

    let abortHandler: (() => void) | null = null;
    const fakeSignal = {
      aborted: false,
      addEventListener: (event: string, handler: () => void) => {
        if (event === "abort") {
          abortHandler = handler;
        }
      },
      removeEventListener: (event: string, handler: () => void) => {
        if (event === "abort" && abortHandler === handler) {
          abortHandler = null;
        }
      },
    } as AbortSignal;

    const promise = wrapped("https://example.com", { signal: fakeSignal });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(seenSignal).toBeInstanceOf(AbortSignal);
    expect(seenSignal).not.toBe(fakeSignal);

    abortHandler?.();
    expect(seenSignal?.aborted).toBe(true);

    await promise;
  });
});
