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

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readTelegramUpdateOffset, writeTelegramUpdateOffset } from "./update-offset-store.js";

async function withTempStateDir<T>(fn: (dir: string) => Promise<T>) {
  const previous = process.env.MARKETBOT_STATE_DIR;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-telegram-"));
  process.env.MARKETBOT_STATE_DIR = dir;
  try {
    return await fn(dir);
  } finally {
    if (previous === undefined) {
      delete process.env.MARKETBOT_STATE_DIR;
    } else {
      process.env.MARKETBOT_STATE_DIR = previous;
    }
    await fs.rm(dir, { recursive: true, force: true });
  }
}

describe("telegram update offset store", () => {
  it("persists and reloads the last update id", async () => {
    await withTempStateDir(async () => {
      expect(await readTelegramUpdateOffset({ accountId: "primary" })).toBeNull();

      await writeTelegramUpdateOffset({
        accountId: "primary",
        updateId: 421,
      });

      expect(await readTelegramUpdateOffset({ accountId: "primary" })).toBe(421);
    });
  });
});
