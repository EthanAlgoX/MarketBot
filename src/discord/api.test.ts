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

import { fetchDiscord } from "./api.js";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("fetchDiscord", () => {
  it("formats rate limit payloads without raw JSON", async () => {
    const fetcher = async () =>
      jsonResponse(
        {
          message: "You are being rate limited.",
          retry_after: 0.631,
          global: false,
        },
        429,
      );

    let error: unknown;
    try {
      await fetchDiscord("/users/@me/guilds", "test", fetcher as typeof fetch, {
        retry: { attempts: 1 },
      });
    } catch (err) {
      error = err;
    }

    const message = String(error);
    expect(message).toContain("Discord API /users/@me/guilds failed (429)");
    expect(message).toContain("You are being rate limited.");
    expect(message).toContain("retry after 0.6s");
    expect(message).not.toContain("{");
    expect(message).not.toContain("retry_after");
  });

  it("preserves non-JSON error text", async () => {
    const fetcher = async () => new Response("Not Found", { status: 404 });
    await expect(
      fetchDiscord("/users/@me/guilds", "test", fetcher as typeof fetch, {
        retry: { attempts: 1 },
      }),
    ).rejects.toThrow("Discord API /users/@me/guilds failed (404): Not Found");
  });

  it("retries rate limits before succeeding", async () => {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse(
          {
            message: "You are being rate limited.",
            retry_after: 0,
            global: false,
          },
          429,
        );
      }
      return jsonResponse([{ id: "1", name: "Guild" }], 200);
    };

    const result = await fetchDiscord<Array<{ id: string; name: string }>>(
      "/users/@me/guilds",
      "test",
      fetcher as typeof fetch,
      { retry: { attempts: 2, minDelayMs: 0, maxDelayMs: 0 } },
    );

    expect(result).toHaveLength(1);
    expect(calls).toBe(2);
  });
});
