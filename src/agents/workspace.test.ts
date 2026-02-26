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

import path from "node:path";

import { mkdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_MEMORY_ABSTRACT_PATH,
  DEFAULT_SESSION_STATE_FILENAME,
  loadWorkspaceBootstrapFiles,
} from "./workspace.js";
import { makeTempWorkspace, writeWorkspaceFile } from "../test-helpers/workspace.js";

describe("loadWorkspaceBootstrapFiles", () => {
  it("includes SESSION-STATE.md when present", async () => {
    const tempDir = await makeTempWorkspace("marketbot-workspace-");
    await writeWorkspaceFile({ dir: tempDir, name: "SESSION-STATE.md", content: "state" });

    const files = await loadWorkspaceBootstrapFiles(tempDir);
    const stateEntries = files.filter((file) => file.name === DEFAULT_SESSION_STATE_FILENAME);

    expect(stateEntries).toHaveLength(1);
    expect(stateEntries[0]?.missing).toBe(false);
    expect(stateEntries[0]?.content).toBe("state");
  });

  it("includes memory/.abstract when present", async () => {
    const tempDir = await makeTempWorkspace("marketbot-workspace-");
    await mkdir(path.join(tempDir, "memory"), { recursive: true });
    await writeWorkspaceFile({ dir: tempDir, name: "memory/.abstract", content: "index" });

    const files = await loadWorkspaceBootstrapFiles(tempDir);
    const abstractEntries = files.filter((file) => file.name === DEFAULT_MEMORY_ABSTRACT_PATH);

    expect(abstractEntries).toHaveLength(1);
    expect(abstractEntries[0]?.missing).toBe(false);
    expect(abstractEntries[0]?.content).toBe("index");
  });

  it("omits memory bootstrap summaries when no files exist", async () => {
    const tempDir = await makeTempWorkspace("marketbot-workspace-");

    const files = await loadWorkspaceBootstrapFiles(tempDir);
    const memoryEntries = files.filter((file) =>
      [DEFAULT_MEMORY_ABSTRACT_PATH, DEFAULT_SESSION_STATE_FILENAME].includes(file.name),
    );

    expect(memoryEntries).toHaveLength(0);
  });
});
