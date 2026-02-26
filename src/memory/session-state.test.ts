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

import { refreshSessionState } from "./session-state.js";

describe("session-state refresh", () => {
  let workspaceDir: string;

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-session-state-"));
    await fs.mkdir(path.join(workspaceDir, "memory"), { recursive: true });
    await fs.writeFile(
      path.join(workspaceDir, "memory", "2026-02-17.md"),
      "# Daily log\nCaptured setup detail.",
      "utf-8",
    );
    await fs.writeFile(
      path.join(workspaceDir, "MEMORY.md"),
      "# Profile\nStable preferences.",
      "utf-8",
    );
  });

  afterEach(async () => {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  it("does not rewrite SESSION-STATE.md when sources are unchanged", async () => {
    const first = await refreshSessionState({ workspaceDir });
    expect(first.written).toBe(true);

    const sessionStatePath = path.join(workspaceDir, "SESSION-STATE.md");
    const firstContent = await fs.readFile(sessionStatePath, "utf-8");

    const second = await refreshSessionState({ workspaceDir });
    expect(second.written).toBe(false);

    const secondContent = await fs.readFile(sessionStatePath, "utf-8");
    expect(secondContent).toBe(firstContent);
  });
});
