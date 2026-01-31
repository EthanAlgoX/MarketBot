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
import { resolveAuthProfileOrder } from "./auth-profiles.js";

describe("resolveAuthProfileOrder", () => {
  const _store: AuthProfileStore = {
    version: 1,
    profiles: {
      "anthropic:default": {
        type: "api_key",
        provider: "anthropic",
        key: "sk-default",
      },
      "anthropic:work": {
        type: "api_key",
        provider: "anthropic",
        key: "sk-work",
      },
    },
  };
  const _cfg = {
    auth: {
      profiles: {
        "anthropic:default": { provider: "anthropic", mode: "api_key" },
        "anthropic:work": { provider: "anthropic", mode: "api_key" },
      },
    },
  };

  it("orders by lastUsed when no explicit order exists", () => {
    const order = resolveAuthProfileOrder({
      store: {
        version: 1,
        profiles: {
          "anthropic:a": {
            type: "oauth",
            provider: "anthropic",
            access: "access-token",
            refresh: "refresh-token",
            expires: Date.now() + 60_000,
          },
          "anthropic:b": {
            type: "api_key",
            provider: "anthropic",
            key: "sk-b",
          },
          "anthropic:c": {
            type: "api_key",
            provider: "anthropic",
            key: "sk-c",
          },
        },
        usageStats: {
          "anthropic:a": { lastUsed: 200 },
          "anthropic:b": { lastUsed: 100 },
          "anthropic:c": { lastUsed: 300 },
        },
      },
      provider: "anthropic",
    });
    expect(order).toEqual(["anthropic:a", "anthropic:b", "anthropic:c"]);
  });
  it("pushes cooldown profiles to the end, ordered by cooldown expiry", () => {
    const now = Date.now();
    const order = resolveAuthProfileOrder({
      store: {
        version: 1,
        profiles: {
          "anthropic:ready": {
            type: "api_key",
            provider: "anthropic",
            key: "sk-ready",
          },
          "anthropic:cool1": {
            type: "oauth",
            provider: "anthropic",
            access: "access-token",
            refresh: "refresh-token",
            expires: now + 60_000,
          },
          "anthropic:cool2": {
            type: "api_key",
            provider: "anthropic",
            key: "sk-cool",
          },
        },
        usageStats: {
          "anthropic:ready": { lastUsed: 50 },
          "anthropic:cool1": { cooldownUntil: now + 5_000 },
          "anthropic:cool2": { cooldownUntil: now + 1_000 },
        },
      },
      provider: "anthropic",
    });
    expect(order).toEqual(["anthropic:ready", "anthropic:cool2", "anthropic:cool1"]);
  });
});
