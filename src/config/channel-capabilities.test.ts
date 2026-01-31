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

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChannelPlugin } from "../channels/plugins/types.js";
import type { PluginRegistry } from "../plugins/registry.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { resolveChannelCapabilities } from "./channel-capabilities.js";
import type { MarketBotConfig } from "./config.js";

describe("resolveChannelCapabilities", () => {
  beforeEach(() => {
    setActivePluginRegistry(baseRegistry);
  });

  afterEach(() => {
    setActivePluginRegistry(baseRegistry);
  });

  it("returns undefined for missing inputs", () => {
    expect(resolveChannelCapabilities({})).toBeUndefined();
    expect(resolveChannelCapabilities({ cfg: {} })).toBeUndefined();
    expect(resolveChannelCapabilities({ cfg: {}, channel: "" })).toBeUndefined();
  });

  it("normalizes and prefers per-account capabilities", () => {
    const cfg = {
      channels: {
        telegram: {
          capabilities: [" inlineButtons ", ""],
          accounts: {
            default: {
              capabilities: [" perAccount ", "  "],
            },
          },
        },
      },
    } satisfies Partial<MarketBotConfig>;

    expect(
      resolveChannelCapabilities({
        cfg,
        channel: "telegram",
        accountId: "default",
      }),
    ).toEqual(["perAccount"]);
  });

  it("falls back to provider capabilities when account capabilities are missing", () => {
    const cfg = {
      channels: {
        telegram: {
          capabilities: ["inlineButtons"],
          accounts: {
            default: {},
          },
        },
      },
    } satisfies Partial<MarketBotConfig>;

    expect(
      resolveChannelCapabilities({
        cfg,
        channel: "telegram",
        accountId: "default",
      }),
    ).toEqual(["inlineButtons"]);
  });

  it("matches account keys case-insensitively", () => {
    const cfg = {
      channels: {
        slack: {
          accounts: {
            Family: { capabilities: ["threads"] },
          },
        },
      },
    } satisfies Partial<MarketBotConfig>;

    expect(
      resolveChannelCapabilities({
        cfg,
        channel: "slack",
        accountId: "family",
      }),
    ).toEqual(["threads"]);
  });

  it("supports msteams capabilities", () => {
    setActivePluginRegistry(
      createRegistry([
        {
          pluginId: "msteams",
          source: "test",
          plugin: createMSTeamsPlugin(),
        },
      ]),
    );
    const cfg = {
      channels: { msteams: { capabilities: [" polls ", ""] } },
    } satisfies Partial<MarketBotConfig>;

    expect(
      resolveChannelCapabilities({
        cfg,
        channel: "msteams",
      }),
    ).toEqual(["polls"]);
  });

  it("handles object-format capabilities gracefully (e.g., { inlineButtons: 'dm' })", () => {
    const cfg = {
      channels: {
        telegram: {
          // Object format - used for granular control like inlineButtons scope.
          // Channel-specific handlers (resolveTelegramInlineButtonsScope) process these.
          capabilities: { inlineButtons: "dm" },
        },
      },
    };

    // Should return undefined (not crash), allowing channel-specific handlers to process it.
    expect(
      resolveChannelCapabilities({
        cfg,
        channel: "telegram",
      }),
    ).toBeUndefined();
  });
});

const createRegistry = (channels: PluginRegistry["channels"]): PluginRegistry => ({
  plugins: [],
  tools: [],
  channels,
  providers: [],
  gatewayHandlers: {},
  httpHandlers: [],
  httpRoutes: [],
  cliRegistrars: [],
  services: [],
  diagnostics: [],
});

const createStubPlugin = (id: string): ChannelPlugin => ({
  id,
  meta: {
    id,
    label: id,
    selectionLabel: id,
    docsPath: `/channels/${id}`,
    blurb: "test stub.",
  },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: () => [],
    resolveAccount: () => ({}),
  },
});

const baseRegistry = createRegistry([
  { pluginId: "telegram", source: "test", plugin: createStubPlugin("telegram") },
  { pluginId: "slack", source: "test", plugin: createStubPlugin("slack") },
]);

const createMSTeamsPlugin = (): ChannelPlugin => ({
  id: "msteams",
  meta: {
    id: "msteams",
    label: "Microsoft Teams",
    selectionLabel: "Microsoft Teams (Bot Framework)",
    docsPath: "/channels/msteams",
    blurb: "Bot Framework; enterprise support.",
  },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: () => [],
    resolveAccount: () => ({}),
  },
});
