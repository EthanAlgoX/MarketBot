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

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runMemoryJanitor } from "./janitor.js";

describe("memory janitor", () => {
  let workspaceDir: string;

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-janitor-"));
    await fs.mkdir(path.join(workspaceDir, "memory"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it("moves expired p2 files to archive", async () => {
    const file = path.join(workspaceDir, "memory", "2026-02-17.md");
    await fs.writeFile(file, "# note\n#P2\n");
    const old = new Date("2020-01-01T00:00:00.000Z");
    await fs.utimes(file, old, old);

    const result = await runMemoryJanitor({
      workspaceDir,
      p1Days: 90,
      p2Days: 30,
      dryRun: false,
      nowMs: Date.parse("2026-02-26T00:00:00.000Z"),
    });

    expect(result.moved.length).toBe(1);
    expect(result.moved[0]?.priority).toBe("p2");
    const archived = path.join(workspaceDir, "memory", "archive", "2026-02-17.md");
    await expect(fs.stat(archived)).resolves.toBeTruthy();
  });

  it("supports dry run", async () => {
    const file = path.join(workspaceDir, "memory", "tmp.md");
    await fs.writeFile(file, "# todo\n[P1]\n");
    const old = new Date("2020-01-01T00:00:00.000Z");
    await fs.utimes(file, old, old);

    const result = await runMemoryJanitor({
      workspaceDir,
      dryRun: true,
      nowMs: Date.parse("2026-02-26T00:00:00.000Z"),
    });

    expect(result.dryRun).toBe(true);
    expect(result.moved.length).toBe(1);
    await expect(fs.stat(file)).resolves.toBeTruthy();
  });
});
