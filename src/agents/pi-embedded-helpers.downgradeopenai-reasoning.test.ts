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
import { downgradeOpenAIReasoningBlocks } from "./pi-embedded-helpers.js";

describe("downgradeOpenAIReasoningBlocks", () => {
  it("keeps reasoning signatures when followed by content", () => {
    const input = [
      {
        role: "assistant",
        content: [
          {
            type: "thinking",
            thinking: "internal reasoning",
            thinkingSignature: JSON.stringify({ id: "rs_123", type: "reasoning" }),
          },
          { type: "text", text: "answer" },
        ],
      },
    ];

    expect(downgradeOpenAIReasoningBlocks(input as any)).toEqual(input);
  });

  it("drops orphaned reasoning blocks without following content", () => {
    const input = [
      {
        role: "assistant",
        content: [
          {
            type: "thinking",
            thinkingSignature: JSON.stringify({ id: "rs_abc", type: "reasoning" }),
          },
        ],
      },
      { role: "user", content: "next" },
    ];

    expect(downgradeOpenAIReasoningBlocks(input as any)).toEqual([
      { role: "user", content: "next" },
    ]);
  });

  it("drops object-form orphaned signatures", () => {
    const input = [
      {
        role: "assistant",
        content: [
          {
            type: "thinking",
            thinkingSignature: { id: "rs_obj", type: "reasoning" },
          },
        ],
      },
    ];

    expect(downgradeOpenAIReasoningBlocks(input as any)).toEqual([]);
  });

  it("keeps non-reasoning thinking signatures", () => {
    const input = [
      {
        role: "assistant",
        content: [
          {
            type: "thinking",
            thinking: "t",
            thinkingSignature: "reasoning_content",
          },
        ],
      },
    ];

    expect(downgradeOpenAIReasoningBlocks(input as any)).toEqual(input);
  });
});
