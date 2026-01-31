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

import type { MarketBotConfig } from "../../config/config.js";
import { resolveTelegramDraftStreamingChunking } from "./draft-chunking.js";

describe("resolveTelegramDraftStreamingChunking", () => {
  it("uses smaller defaults than block streaming", () => {
    const chunking = resolveTelegramDraftStreamingChunking(undefined, "default");
    expect(chunking).toEqual({
      minChars: 200,
      maxChars: 800,
      breakPreference: "paragraph",
    });
  });

  it("clamps to telegram.textChunkLimit", () => {
    const cfg: MarketBotConfig = {
      channels: { telegram: { allowFrom: ["*"], textChunkLimit: 150 } },
    };
    const chunking = resolveTelegramDraftStreamingChunking(cfg, "default");
    expect(chunking).toEqual({
      minChars: 150,
      maxChars: 150,
      breakPreference: "paragraph",
    });
  });

  it("supports per-account overrides", () => {
    const cfg: MarketBotConfig = {
      channels: {
        telegram: {
          allowFrom: ["*"],
          accounts: {
            default: {
              allowFrom: ["*"],
              draftChunk: {
                minChars: 10,
                maxChars: 20,
                breakPreference: "sentence",
              },
            },
          },
        },
      },
    };
    const chunking = resolveTelegramDraftStreamingChunking(cfg, "default");
    expect(chunking).toEqual({
      minChars: 10,
      maxChars: 20,
      breakPreference: "sentence",
    });
  });
});
