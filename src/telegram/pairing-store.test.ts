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

import {
  approveTelegramPairingCode,
  listTelegramPairingRequests,
  readTelegramAllowFromStore,
  upsertTelegramPairingRequest,
} from "./pairing-store.js";

async function withTempStateDir<T>(fn: (stateDir: string) => Promise<T>) {
  const previous = process.env.MARKETBOT_STATE_DIR;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-pairing-"));
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

describe("telegram pairing store", () => {
  it("creates pairing request and approves it into allow store", async () => {
    await withTempStateDir(async () => {
      const created = await upsertTelegramPairingRequest({
        chatId: "123456789",
        username: "ada",
      });
      expect(created.code).toBeTruthy();

      const list = await listTelegramPairingRequests();
      expect(list).toHaveLength(1);
      expect(list[0]?.chatId).toBe("123456789");
      expect(list[0]?.code).toBe(created.code);

      const approved = await approveTelegramPairingCode({ code: created.code });
      expect(approved?.chatId).toBe("123456789");

      const listAfter = await listTelegramPairingRequests();
      expect(listAfter).toHaveLength(0);

      const allow = await readTelegramAllowFromStore();
      expect(allow).toContain("123456789");
    });
  });
});
