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

import { SILENT_REPLY_TOKEN } from "../tokens.js";
import { normalizeReplyPayload } from "./normalize-reply.js";

// Keep channelData-only payloads so channel-specific replies survive normalization.
describe("normalizeReplyPayload", () => {
  it("keeps channelData-only replies", () => {
    const payload = {
      channelData: {
        line: {
          flexMessage: { type: "bubble" },
        },
      },
    };

    const normalized = normalizeReplyPayload(payload);

    expect(normalized).not.toBeNull();
    expect(normalized?.text).toBeUndefined();
    expect(normalized?.channelData).toEqual(payload.channelData);
  });

  it("records silent skips", () => {
    const reasons: string[] = [];
    const normalized = normalizeReplyPayload(
      { text: SILENT_REPLY_TOKEN },
      {
        onSkip: (reason) => reasons.push(reason),
      },
    );

    expect(normalized).toBeNull();
    expect(reasons).toEqual(["silent"]);
  });

  it("records empty skips", () => {
    const reasons: string[] = [];
    const normalized = normalizeReplyPayload(
      { text: "   " },
      {
        onSkip: (reason) => reasons.push(reason),
      },
    );

    expect(normalized).toBeNull();
    expect(reasons).toEqual(["empty"]);
  });
});
