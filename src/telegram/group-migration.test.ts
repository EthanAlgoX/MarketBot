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

import { migrateTelegramGroupConfig } from "./group-migration.js";

describe("migrateTelegramGroupConfig", () => {
  it("migrates global group ids", () => {
    const cfg = {
      channels: {
        telegram: {
          groups: {
            "-123": { requireMention: false },
          },
        },
      },
    };

    const result = migrateTelegramGroupConfig({
      cfg,
      accountId: "default",
      oldChatId: "-123",
      newChatId: "-100123",
    });

    expect(result.migrated).toBe(true);
    expect(cfg.channels.telegram.groups).toEqual({
      "-100123": { requireMention: false },
    });
  });

  it("migrates account-scoped groups", () => {
    const cfg = {
      channels: {
        telegram: {
          accounts: {
            primary: {
              groups: {
                "-123": { requireMention: true },
              },
            },
          },
        },
      },
    };

    const result = migrateTelegramGroupConfig({
      cfg,
      accountId: "primary",
      oldChatId: "-123",
      newChatId: "-100123",
    });

    expect(result.migrated).toBe(true);
    expect(result.scopes).toEqual(["account"]);
    expect(cfg.channels.telegram.accounts.primary.groups).toEqual({
      "-100123": { requireMention: true },
    });
  });

  it("matches account ids case-insensitively", () => {
    const cfg = {
      channels: {
        telegram: {
          accounts: {
            Primary: {
              groups: {
                "-123": {},
              },
            },
          },
        },
      },
    };

    const result = migrateTelegramGroupConfig({
      cfg,
      accountId: "primary",
      oldChatId: "-123",
      newChatId: "-100123",
    });

    expect(result.migrated).toBe(true);
    expect(cfg.channels.telegram.accounts.Primary.groups).toEqual({
      "-100123": {},
    });
  });

  it("skips migration when new id already exists", () => {
    const cfg = {
      channels: {
        telegram: {
          groups: {
            "-123": { requireMention: true },
            "-100123": { requireMention: false },
          },
        },
      },
    };

    const result = migrateTelegramGroupConfig({
      cfg,
      accountId: "default",
      oldChatId: "-123",
      newChatId: "-100123",
    });

    expect(result.migrated).toBe(false);
    expect(result.skippedExisting).toBe(true);
    expect(cfg.channels.telegram.groups).toEqual({
      "-123": { requireMention: true },
      "-100123": { requireMention: false },
    });
  });
});
