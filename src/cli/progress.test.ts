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

import { createCliProgress } from "./progress.js";

describe("cli progress", () => {
  it("logs progress when non-tty and fallback=log", () => {
    const writes: string[] = [];
    const stream = {
      isTTY: false,
      write: vi.fn((chunk: string) => {
        writes.push(chunk);
      }),
    } as unknown as NodeJS.WriteStream;

    const progress = createCliProgress({
      label: "Indexing memory...",
      total: 10,
      stream,
      fallback: "log",
    });
    progress.setPercent(50);
    progress.done();

    const output = writes.join("");
    expect(output).toContain("Indexing memory... 0%");
    expect(output).toContain("Indexing memory... 50%");
  });

  it("does not log without a tty when fallback is none", () => {
    const write = vi.fn();
    const stream = {
      isTTY: false,
      write,
    } as unknown as NodeJS.WriteStream;

    const progress = createCliProgress({
      label: "Nope",
      total: 2,
      stream,
      fallback: "none",
    });
    progress.setPercent(50);
    progress.done();

    expect(write).not.toHaveBeenCalled();
  });
});
