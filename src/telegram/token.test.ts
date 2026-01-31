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

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { MarketBotConfig } from "../config/config.js";
import { resolveTelegramToken } from "./token.js";

function withTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "marketbot-telegram-token-"));
}

describe("resolveTelegramToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers config token over env", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "env-token");
    const cfg = {
      channels: { telegram: { botToken: "cfg-token" } },
    } as MarketBotConfig;
    const res = resolveTelegramToken(cfg);
    expect(res.token).toBe("cfg-token");
    expect(res.source).toBe("config");
  });

  it("uses env token when config is missing", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "env-token");
    const cfg = {
      channels: { telegram: {} },
    } as MarketBotConfig;
    const res = resolveTelegramToken(cfg);
    expect(res.token).toBe("env-token");
    expect(res.source).toBe("env");
  });

  it("uses tokenFile when configured", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const dir = withTempDir();
    const tokenFile = path.join(dir, "token.txt");
    fs.writeFileSync(tokenFile, "file-token\n", "utf-8");
    const cfg = { channels: { telegram: { tokenFile } } } as MarketBotConfig;
    const res = resolveTelegramToken(cfg);
    expect(res.token).toBe("file-token");
    expect(res.source).toBe("tokenFile");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("falls back to config token when no env or tokenFile", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const cfg = {
      channels: { telegram: { botToken: "cfg-token" } },
    } as MarketBotConfig;
    const res = resolveTelegramToken(cfg);
    expect(res.token).toBe("cfg-token");
    expect(res.source).toBe("config");
  });

  it("does not fall back to config when tokenFile is missing", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const dir = withTempDir();
    const tokenFile = path.join(dir, "missing-token.txt");
    const cfg = {
      channels: { telegram: { tokenFile, botToken: "cfg-token" } },
    } as MarketBotConfig;
    const res = resolveTelegramToken(cfg);
    expect(res.token).toBe("");
    expect(res.source).toBe("none");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("resolves per-account tokens when the config account key casing doesn't match routing normalization", () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const cfg = {
      channels: {
        telegram: {
          accounts: {
            // Note the mixed-case key; runtime accountId is normalized.
            careyNotifications: { botToken: "acct-token" },
          },
        },
      },
    } as MarketBotConfig;

    const res = resolveTelegramToken(cfg, { accountId: "careynotifications" });
    expect(res.token).toBe("acct-token");
    expect(res.source).toBe("config");
  });
});
