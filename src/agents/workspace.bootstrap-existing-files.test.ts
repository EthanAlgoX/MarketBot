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

import { afterEach, describe, expect, it, vi } from "vitest";

const { mockResolveWorkspaceTemplateDir } = vi.hoisted(() => ({
  mockResolveWorkspaceTemplateDir: vi.fn(),
}));

vi.mock("./workspace-templates.js", () => ({
  resolveWorkspaceTemplateDir: mockResolveWorkspaceTemplateDir,
}));

import {
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_USER_FILENAME,
  ensureAgentWorkspace,
} from "./workspace.js";

describe("ensureAgentWorkspace", () => {
  const tmpDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tmpDirs.map(async (dir) => await fs.rm(dir, { recursive: true, force: true })),
    );
    tmpDirs.length = 0;
    mockResolveWorkspaceTemplateDir.mockReset();
  });

  it("does not read template files when bootstrap files already exist", async () => {
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "marketbot-workspace-"));
    tmpDirs.push(workspaceDir);
    const requiredFiles = [
      DEFAULT_AGENTS_FILENAME,
      DEFAULT_SOUL_FILENAME,
      DEFAULT_TOOLS_FILENAME,
      DEFAULT_IDENTITY_FILENAME,
      DEFAULT_USER_FILENAME,
      DEFAULT_HEARTBEAT_FILENAME,
    ];
    await Promise.all(
      requiredFiles.map(async (name) => {
        await fs.writeFile(path.join(workspaceDir, name), `# ${name}\n`, "utf-8");
      }),
    );

    mockResolveWorkspaceTemplateDir.mockResolvedValue("/definitely/missing/templates");

    await expect(
      ensureAgentWorkspace({
        dir: workspaceDir,
        ensureBootstrapFiles: true,
      }),
    ).resolves.toMatchObject({ dir: workspaceDir });
    expect(mockResolveWorkspaceTemplateDir).not.toHaveBeenCalled();
  });
});
