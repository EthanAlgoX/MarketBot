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

import { scanOpenRouterModels } from "./model-scan.js";

function createFetchFixture(payload: unknown): typeof fetch {
  return async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
}

describe("scanOpenRouterModels", () => {
  it("lists free models without probing", async () => {
    const fetchImpl = createFetchFixture({
      data: [
        {
          id: "acme/free-by-pricing",
          name: "Free By Pricing",
          context_length: 16_384,
          max_completion_tokens: 1024,
          supported_parameters: ["tools", "tool_choice", "temperature"],
          modality: "text",
          pricing: { prompt: "0", completion: "0", request: "0", image: "0" },
          created_at: 1_700_000_000,
        },
        {
          id: "acme/free-by-suffix:free",
          name: "Free By Suffix",
          context_length: 8_192,
          supported_parameters: [],
          modality: "text",
          pricing: { prompt: "0", completion: "0" },
        },
        {
          id: "acme/paid",
          name: "Paid",
          context_length: 4_096,
          supported_parameters: ["tools"],
          modality: "text",
          pricing: { prompt: "0.000001", completion: "0.000002" },
        },
      ],
    });

    const results = await scanOpenRouterModels({
      fetchImpl,
      probe: false,
    });

    expect(results.map((entry) => entry.id)).toEqual([
      "acme/free-by-pricing",
      "acme/free-by-suffix:free",
    ]);

    const [byPricing] = results;
    expect(byPricing).toBeTruthy();
    if (!byPricing) {
      throw new Error("Expected pricing-based model result.");
    }
    expect(byPricing.supportsToolsMeta).toBe(true);
    expect(byPricing.supportedParametersCount).toBe(3);
    expect(byPricing.isFree).toBe(true);
    expect(byPricing.tool.skipped).toBe(true);
    expect(byPricing.image.skipped).toBe(true);
  });

  it("requires an API key when probing", async () => {
    const fetchImpl = createFetchFixture({ data: [] });
    const previousKey = process.env.OPENROUTER_API_KEY;
    try {
      delete process.env.OPENROUTER_API_KEY;
      await expect(
        scanOpenRouterModels({
          fetchImpl,
          probe: true,
          apiKey: "",
        }),
      ).rejects.toThrow(/Missing OpenRouter API key/);
    } finally {
      if (previousKey === undefined) {
        delete process.env.OPENROUTER_API_KEY;
      } else {
        process.env.OPENROUTER_API_KEY = previousKey;
      }
    }
  });
});
