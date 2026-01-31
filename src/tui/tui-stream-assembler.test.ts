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

import { TuiStreamAssembler } from "./tui-stream-assembler.js";

describe("TuiStreamAssembler", () => {
  it("keeps thinking before content even when thinking arrives later", () => {
    const assembler = new TuiStreamAssembler();
    const first = assembler.ingestDelta(
      "run-1",
      {
        role: "assistant",
        content: [{ type: "text", text: "Hello" }],
      },
      true,
    );
    expect(first).toBe("Hello");

    const second = assembler.ingestDelta(
      "run-1",
      {
        role: "assistant",
        content: [{ type: "thinking", thinking: "Brain" }],
      },
      true,
    );
    expect(second).toBe("[thinking]\nBrain\n\nHello");
  });

  it("omits thinking when showThinking is false", () => {
    const assembler = new TuiStreamAssembler();
    const text = assembler.ingestDelta(
      "run-2",
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Hidden" },
          { type: "text", text: "Visible" },
        ],
      },
      false,
    );

    expect(text).toBe("Visible");
  });

  it("falls back to streamed text on empty final payload", () => {
    const assembler = new TuiStreamAssembler();
    assembler.ingestDelta(
      "run-3",
      {
        role: "assistant",
        content: [{ type: "text", text: "Streamed" }],
      },
      false,
    );

    const finalText = assembler.finalize(
      "run-3",
      {
        role: "assistant",
        content: [],
      },
      false,
    );

    expect(finalText).toBe("Streamed");
  });

  it("returns null when delta text is unchanged", () => {
    const assembler = new TuiStreamAssembler();
    const first = assembler.ingestDelta(
      "run-4",
      {
        role: "assistant",
        content: [{ type: "text", text: "Repeat" }],
      },
      false,
    );

    expect(first).toBe("Repeat");

    const second = assembler.ingestDelta(
      "run-4",
      {
        role: "assistant",
        content: [{ type: "text", text: "Repeat" }],
      },
      false,
    );

    expect(second).toBeNull();
  });
});
