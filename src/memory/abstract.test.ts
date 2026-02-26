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

import { rebuildMemoryAbstracts } from "./abstract.js";

describe("memory abstract", () => {
  let workspaceDir: string;

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-memory-abstract-"));
    await fs.mkdir(path.join(workspaceDir, "memory", "insights"), { recursive: true });
    await fs.mkdir(path.join(workspaceDir, "memory", "lessons"), { recursive: true });
    await fs.writeFile(
      path.join(workspaceDir, "memory", "insights", "2026-02.md"),
      "# Trading insights\nShared trading context from insights.",
      "utf-8",
    );
    await fs.writeFile(
      path.join(workspaceDir, "memory", "lessons", "operational-lessons.md"),
      "# Trading lessons\nShared trading context from lessons.",
      "utf-8",
    );
  });

  afterEach(async () => {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it("is stable when no content changes and emits root cross-references", async () => {
    const first = await rebuildMemoryAbstracts({ workspaceDir });
    expect(first.written.length).toBeGreaterThan(0);

    const rootAbstractPath = path.join(workspaceDir, "memory", ".abstract");
    const rootAbstract = await fs.readFile(rootAbstractPath, "utf-8");
    expect(rootAbstract).toContain("## Cross-References");
    expect(rootAbstract).toMatch(/^- trading:/m);

    const second = await rebuildMemoryAbstracts({ workspaceDir });
    expect(second.written.length).toBe(0);
  });
});
