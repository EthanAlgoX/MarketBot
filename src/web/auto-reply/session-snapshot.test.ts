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

import { describe, expect, it, vi } from "vitest";

import { saveSessionStore } from "../../config/sessions.js";
import { getSessionSnapshot } from "./session-snapshot.js";

describe("getSessionSnapshot", () => {
  it("uses channel reset overrides when configured", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 18, 5, 0, 0));
    try {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-snapshot-"));
      const storePath = path.join(root, "sessions.json");
      const sessionKey = "agent:main:whatsapp:dm:s1";

      await saveSessionStore(storePath, {
        [sessionKey]: {
          sessionId: "snapshot-session",
          updatedAt: new Date(2026, 0, 18, 3, 30, 0).getTime(),
          lastChannel: "whatsapp",
        },
      });

      const cfg = {
        session: {
          store: storePath,
          reset: { mode: "daily", atHour: 4, idleMinutes: 240 },
          resetByChannel: {
            whatsapp: { mode: "idle", idleMinutes: 360 },
          },
        },
      } as Parameters<typeof getSessionSnapshot>[0];

      const snapshot = getSessionSnapshot(cfg, "whatsapp:+15550001111", true, {
        sessionKey,
      });

      expect(snapshot.resetPolicy.mode).toBe("idle");
      expect(snapshot.resetPolicy.idleMinutes).toBe(360);
      expect(snapshot.fresh).toBe(true);
      expect(snapshot.dailyResetAt).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
