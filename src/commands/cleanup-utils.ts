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
import path from "node:path";

import { resolveDefaultAgentWorkspaceDir } from "../agents/workspace.js";
import type { MarketBotConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import { resolveHomeDir, resolveUserPath, shortenHomeInString } from "../utils.js";

export type RemovalResult = {
  ok: boolean;
  skipped?: boolean;
};

export function collectWorkspaceDirs(cfg: MarketBotConfig | undefined): string[] {
  const dirs = new Set<string>();
  const defaults = cfg?.agents?.defaults;
  if (typeof defaults?.workspace === "string" && defaults.workspace.trim()) {
    dirs.add(resolveUserPath(defaults.workspace));
  }
  const list = Array.isArray(cfg?.agents?.list) ? cfg?.agents?.list : [];
  for (const agent of list) {
    const workspace = (agent as { workspace?: unknown }).workspace;
    if (typeof workspace === "string" && workspace.trim()) {
      dirs.add(resolveUserPath(workspace));
    }
  }
  if (dirs.size === 0) {
    dirs.add(resolveDefaultAgentWorkspaceDir());
  }
  return [...dirs];
}

export function isPathWithin(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isUnsafeRemovalTarget(target: string): boolean {
  if (!target.trim()) {
    return true;
  }
  const resolved = path.resolve(target);
  const root = path.parse(resolved).root;
  if (resolved === root) {
    return true;
  }
  const home = resolveHomeDir();
  if (home && resolved === path.resolve(home)) {
    return true;
  }
  return false;
}

export async function removePath(
  target: string,
  runtime: RuntimeEnv,
  opts?: { dryRun?: boolean; label?: string },
): Promise<RemovalResult> {
  if (!target?.trim()) {
    return { ok: false, skipped: true };
  }
  const resolved = path.resolve(target);
  const label = opts?.label ?? resolved;
  const displayLabel = shortenHomeInString(label);
  if (isUnsafeRemovalTarget(resolved)) {
    runtime.error(`Refusing to remove unsafe path: ${displayLabel}`);
    return { ok: false };
  }
  if (opts?.dryRun) {
    runtime.log(`[dry-run] remove ${displayLabel}`);
    return { ok: true, skipped: true };
  }
  try {
    await fs.rm(resolved, { recursive: true, force: true });
    runtime.log(`Removed ${displayLabel}`);
    return { ok: true };
  } catch (err) {
    runtime.error(`Failed to remove ${displayLabel}: ${String(err)}`);
    return { ok: false };
  }
}

export async function listAgentSessionDirs(stateDir: string): Promise<string[]> {
  const root = path.join(stateDir, "agents");
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(root, entry.name, "sessions"));
  } catch {
    return [];
  }
}
