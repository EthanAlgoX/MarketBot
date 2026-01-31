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

  it("normalizes z.ai aliases in auth.order", () => {
    const order = resolveAuthProfileOrder({
      cfg: {
        auth: {
          order: { "z.ai": ["zai:work", "zai:default"] },
          profiles: {
            "zai:default": { provider: "zai", mode: "api_key" },
            "zai:work": { provider: "zai", mode: "api_key" },
          },
        },
      },
      store: {
        version: 1,
        profiles: {
          "zai:default": {
            type: "api_key",
            provider: "zai",
            key: "sk-default",
          },
          "zai:work": {
            type: "api_key",
            provider: "zai",
            key: "sk-work",
          },
        },
      },
      provider: "zai",
    });
    expect(order).toEqual(["zai:work", "zai:default"]);
  });
  it("normalizes provider casing in auth.order keys", () => {
    const order = resolveAuthProfileOrder({
      cfg: {
        auth: {
          order: { OpenAI: ["openai:work", "openai:default"] },
          profiles: {
            "openai:default": { provider: "openai", mode: "api_key" },
            "openai:work": { provider: "openai", mode: "api_key" },
          },
        },
      },
      store: {
        version: 1,
        profiles: {
          "openai:default": {
            type: "api_key",
            provider: "openai",
            key: "sk-default",
          },
          "openai:work": {
            type: "api_key",
            provider: "openai",
            key: "sk-work",
          },
        },
      },
      provider: "openai",
    });
    expect(order).toEqual(["openai:work", "openai:default"]);
  });
  it("normalizes z.ai aliases in auth.profiles", () => {
    const order = resolveAuthProfileOrder({
      cfg: {
        auth: {
          profiles: {
            "zai:default": { provider: "z.ai", mode: "api_key" },
            "zai:work": { provider: "Z.AI", mode: "api_key" },
          },
        },
      },
      store: {
        version: 1,
        profiles: {
          "zai:default": {
            type: "api_key",
            provider: "zai",
            key: "sk-default",
          },
          "zai:work": {
            type: "api_key",
            provider: "zai",
            key: "sk-work",
          },
        },
      },
      provider: "zai",
    });
    expect(order).toEqual(["zai:default", "zai:work"]);
  });
  it("prioritizes oauth profiles when order missing", () => {
    const mixedStore: AuthProfileStore = {
      version: 1,
      profiles: {
        "anthropic:default": {
          type: "api_key",
          provider: "anthropic",
          key: "sk-default",
        },
        "anthropic:oauth": {
          type: "oauth",
          provider: "anthropic",
          access: "access-token",
          refresh: "refresh-token",
          expires: Date.now() + 60_000,
        },
      },
    };
    const order = resolveAuthProfileOrder({
      store: mixedStore,
      provider: "anthropic",
    });
    expect(order).toEqual(["anthropic:oauth", "anthropic:default"]);
  });
});
