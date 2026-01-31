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

import { readSessionStoreJson5 } from "./state-migrations.fs.js";

describe("state migrations fs", () => {
  it("treats array session stores as invalid", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-session-store-"));
    const storePath = path.join(dir, "sessions.json");
    await fs.writeFile(storePath, "[]", "utf-8");

    const result = readSessionStoreJson5(storePath);
    expect(result.ok).toBe(false);
    expect(result.store).toEqual({});
  });
});
