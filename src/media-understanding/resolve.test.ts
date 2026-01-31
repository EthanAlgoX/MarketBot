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

import type { MarketBotConfig } from "../config/config.js";
import { resolveEntriesWithActiveFallback, resolveModelEntries } from "./resolve.js";

const providerRegistry = new Map([
  ["openai", { capabilities: ["image"] }],
  ["groq", { capabilities: ["audio"] }],
]);

describe("resolveModelEntries", () => {
  it("uses provider capabilities for shared entries without explicit caps", () => {
    const cfg: MarketBotConfig = {
      tools: {
        media: {
          models: [{ provider: "openai", model: "gpt-5.2" }],
        },
      },
    };

    const imageEntries = resolveModelEntries({
      cfg,
      capability: "image",
      providerRegistry,
    });
    expect(imageEntries).toHaveLength(1);

    const audioEntries = resolveModelEntries({
      cfg,
      capability: "audio",
      providerRegistry,
    });
    expect(audioEntries).toHaveLength(0);
  });

  it("keeps per-capability entries even without explicit caps", () => {
    const cfg: MarketBotConfig = {
      tools: {
        media: {
          image: {
            models: [{ provider: "openai", model: "gpt-5.2" }],
          },
        },
      },
    };

    const imageEntries = resolveModelEntries({
      cfg,
      capability: "image",
      config: cfg.tools?.media?.image,
      providerRegistry,
    });
    expect(imageEntries).toHaveLength(1);
  });

  it("skips shared CLI entries without capabilities", () => {
    const cfg: MarketBotConfig = {
      tools: {
        media: {
          models: [{ type: "cli", command: "gemini", args: ["--file", "{{MediaPath}}"] }],
        },
      },
    };

    const entries = resolveModelEntries({
      cfg,
      capability: "image",
      providerRegistry,
    });
    expect(entries).toHaveLength(0);
  });
});

describe("resolveEntriesWithActiveFallback", () => {
  it("uses active model when enabled and no models are configured", () => {
    const cfg: MarketBotConfig = {
      tools: {
        media: {
          audio: { enabled: true },
        },
      },
    };

    const entries = resolveEntriesWithActiveFallback({
      cfg,
      capability: "audio",
      config: cfg.tools?.media?.audio,
      providerRegistry,
      activeModel: { provider: "groq", model: "whisper-large-v3" },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.provider).toBe("groq");
  });

  it("ignores active model when configured entries exist", () => {
    const cfg: MarketBotConfig = {
      tools: {
        media: {
          audio: { enabled: true, models: [{ provider: "openai", model: "whisper-1" }] },
        },
      },
    };

    const entries = resolveEntriesWithActiveFallback({
      cfg,
      capability: "audio",
      config: cfg.tools?.media?.audio,
      providerRegistry,
      activeModel: { provider: "groq", model: "whisper-large-v3" },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.provider).toBe("openai");
  });

  it("skips active model when provider lacks capability", () => {
    const cfg: MarketBotConfig = {
      tools: {
        media: {
          video: { enabled: true },
        },
      },
    };

    const entries = resolveEntriesWithActiveFallback({
      cfg,
      capability: "video",
      config: cfg.tools?.media?.video,
      providerRegistry,
      activeModel: { provider: "groq", model: "whisper-large-v3" },
    });
    expect(entries).toHaveLength(0);
  });
});
