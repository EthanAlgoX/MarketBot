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

import { createSafeStreamWriter } from "./stream-writer.js";

describe("createSafeStreamWriter", () => {
  it("signals broken pipes and closes the writer", () => {
    const onBrokenPipe = vi.fn();
    const writer = createSafeStreamWriter({ onBrokenPipe });
    const stream = {
      write: vi.fn(() => {
        const err = new Error("EPIPE") as NodeJS.ErrnoException;
        err.code = "EPIPE";
        throw err;
      }),
    } as unknown as NodeJS.WriteStream;

    expect(writer.writeLine(stream, "hello")).toBe(false);
    expect(writer.isClosed()).toBe(true);
    expect(onBrokenPipe).toHaveBeenCalledTimes(1);

    onBrokenPipe.mockClear();
    expect(writer.writeLine(stream, "again")).toBe(false);
    expect(onBrokenPipe).toHaveBeenCalledTimes(0);
  });

  it("treats broken pipes from beforeWrite as closed", () => {
    const onBrokenPipe = vi.fn();
    const writer = createSafeStreamWriter({
      onBrokenPipe,
      beforeWrite: () => {
        const err = new Error("EIO") as NodeJS.ErrnoException;
        err.code = "EIO";
        throw err;
      },
    });
    const stream = { write: vi.fn(() => true) } as unknown as NodeJS.WriteStream;

    expect(writer.write(stream, "hi")).toBe(false);
    expect(writer.isClosed()).toBe(true);
    expect(onBrokenPipe).toHaveBeenCalledTimes(1);
  });
});
