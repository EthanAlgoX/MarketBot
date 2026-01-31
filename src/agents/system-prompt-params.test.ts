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

import type { MarketBotConfig } from "../config/config.js";
import { buildSystemPromptParams } from "./system-prompt-params.js";

async function makeTempDir(label: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `marketbot-${label}-`));
}

async function makeRepoRoot(root: string): Promise<void> {
  await fs.mkdir(path.join(root, ".git"), { recursive: true });
}

function buildParams(params: { config?: MarketBotConfig; workspaceDir?: string; cwd?: string }) {
  return buildSystemPromptParams({
    config: params.config,
    workspaceDir: params.workspaceDir,
    cwd: params.cwd,
    runtime: {
      host: "host",
      os: "os",
      arch: "arch",
      node: "node",
      model: "model",
    },
  });
}

describe("buildSystemPromptParams repo root", () => {
  it("detects repo root from workspaceDir", async () => {
    const temp = await makeTempDir("workspace");
    const repoRoot = path.join(temp, "repo");
    const workspaceDir = path.join(repoRoot, "nested", "workspace");
    await fs.mkdir(workspaceDir, { recursive: true });
    await makeRepoRoot(repoRoot);

    const { runtimeInfo } = buildParams({ workspaceDir });

    expect(runtimeInfo.repoRoot).toBe(repoRoot);
  });

  it("falls back to cwd when workspaceDir has no repo", async () => {
    const temp = await makeTempDir("cwd");
    const repoRoot = path.join(temp, "repo");
    const workspaceDir = path.join(temp, "workspace");
    await fs.mkdir(workspaceDir, { recursive: true });
    await makeRepoRoot(repoRoot);

    const { runtimeInfo } = buildParams({ workspaceDir, cwd: repoRoot });

    expect(runtimeInfo.repoRoot).toBe(repoRoot);
  });

  it("uses configured repoRoot when valid", async () => {
    const temp = await makeTempDir("config");
    const repoRoot = path.join(temp, "config-root");
    const workspaceDir = path.join(temp, "workspace");
    await fs.mkdir(repoRoot, { recursive: true });
    await fs.mkdir(workspaceDir, { recursive: true });
    await makeRepoRoot(workspaceDir);

    const config: MarketBotConfig = {
      agents: {
        defaults: {
          repoRoot,
        },
      },
    };

    const { runtimeInfo } = buildParams({ config, workspaceDir });

    expect(runtimeInfo.repoRoot).toBe(repoRoot);
  });

  it("ignores invalid repoRoot config and auto-detects", async () => {
    const temp = await makeTempDir("invalid");
    const repoRoot = path.join(temp, "repo");
    const workspaceDir = path.join(repoRoot, "workspace");
    await fs.mkdir(workspaceDir, { recursive: true });
    await makeRepoRoot(repoRoot);

    const config: MarketBotConfig = {
      agents: {
        defaults: {
          repoRoot: path.join(temp, "missing"),
        },
      },
    };

    const { runtimeInfo } = buildParams({ config, workspaceDir });

    expect(runtimeInfo.repoRoot).toBe(repoRoot);
  });

  it("returns undefined when no repo is found", async () => {
    const workspaceDir = await makeTempDir("norepo");

    const { runtimeInfo } = buildParams({ workspaceDir });

    expect(runtimeInfo.repoRoot).toBeUndefined();
  });
});
