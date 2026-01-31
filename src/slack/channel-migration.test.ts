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

import { migrateSlackChannelConfig } from "./channel-migration.js";

describe("migrateSlackChannelConfig", () => {
  it("migrates global channel ids", () => {
    const cfg = {
      channels: {
        slack: {
          channels: {
            C123: { requireMention: false },
          },
        },
      },
    };

    const result = migrateSlackChannelConfig({
      cfg,
      accountId: "default",
      oldChannelId: "C123",
      newChannelId: "C999",
    });

    expect(result.migrated).toBe(true);
    expect(cfg.channels.slack.channels).toEqual({
      C999: { requireMention: false },
    });
  });

  it("migrates account-scoped channels", () => {
    const cfg = {
      channels: {
        slack: {
          accounts: {
            primary: {
              channels: {
                C123: { requireMention: true },
              },
            },
          },
        },
      },
    };

    const result = migrateSlackChannelConfig({
      cfg,
      accountId: "primary",
      oldChannelId: "C123",
      newChannelId: "C999",
    });

    expect(result.migrated).toBe(true);
    expect(result.scopes).toEqual(["account"]);
    expect(cfg.channels.slack.accounts.primary.channels).toEqual({
      C999: { requireMention: true },
    });
  });

  it("matches account ids case-insensitively", () => {
    const cfg = {
      channels: {
        slack: {
          accounts: {
            Primary: {
              channels: {
                C123: {},
              },
            },
          },
        },
      },
    };

    const result = migrateSlackChannelConfig({
      cfg,
      accountId: "primary",
      oldChannelId: "C123",
      newChannelId: "C999",
    });

    expect(result.migrated).toBe(true);
    expect(cfg.channels.slack.accounts.Primary.channels).toEqual({
      C999: {},
    });
  });

  it("skips migration when new id already exists", () => {
    const cfg = {
      channels: {
        slack: {
          channels: {
            C123: { requireMention: true },
            C999: { requireMention: false },
          },
        },
      },
    };

    const result = migrateSlackChannelConfig({
      cfg,
      accountId: "default",
      oldChannelId: "C123",
      newChannelId: "C999",
    });

    expect(result.migrated).toBe(false);
    expect(result.skippedExisting).toBe(true);
    expect(cfg.channels.slack.channels).toEqual({
      C123: { requireMention: true },
      C999: { requireMention: false },
    });
  });
});
