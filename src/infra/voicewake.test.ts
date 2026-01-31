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
  defaultVoiceWakeTriggers,
  loadVoiceWakeConfig,
  setVoiceWakeTriggers,
} from "./voicewake.js";

describe("voicewake store", () => {
  it("returns defaults when missing", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-voicewake-"));
    const cfg = await loadVoiceWakeConfig(baseDir);
    expect(cfg.triggers).toEqual(defaultVoiceWakeTriggers());
    expect(cfg.updatedAtMs).toBe(0);
  });

  it("sanitizes and persists triggers", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-voicewake-"));
    const saved = await setVoiceWakeTriggers(["  hi  ", "", "  there "], baseDir);
    expect(saved.triggers).toEqual(["hi", "there"]);
    expect(saved.updatedAtMs).toBeGreaterThan(0);

    const loaded = await loadVoiceWakeConfig(baseDir);
    expect(loaded.triggers).toEqual(["hi", "there"]);
    expect(loaded.updatedAtMs).toBeGreaterThan(0);
  });

  it("falls back to defaults when triggers empty", async () => {
    const baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-voicewake-"));
    const saved = await setVoiceWakeTriggers(["", "   "], baseDir);
    expect(saved.triggers).toEqual(defaultVoiceWakeTriggers());
  });
});
