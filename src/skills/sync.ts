import fs from "node:fs/promises";
import path from "node:path";

import type { MarketBotConfig } from "../config/types.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agentScope.js";
import { resolveManagedSkillsDir } from "./paths.js";
import { bumpSkillsSnapshotVersion } from "./refresh.js";

export interface SyncSkillsOptions {
  agentId?: string;
  cwd?: string;
  sourceDir?: string;
  removeExtra?: boolean;
}

export async function syncSkillsToWorkspace(
  config: MarketBotConfig,
  options: SyncSkillsOptions = {},
): Promise<{ copied: string[]; removed: string[] }> {
  const agentId = options.agentId ?? resolveDefaultAgentId(config);
  const cwd = options.cwd ?? process.cwd();
  const workspaceDir = resolveAgentWorkspaceDir(config, agentId, cwd);
  const targetRoot = path.join(workspaceDir, "skills");
  const sourceRoot = options.sourceDir ?? resolveManagedSkillsDir(config);

  await fs.mkdir(targetRoot, { recursive: true });

  const sourceSkills = await findSkillDirs(sourceRoot);
  const copied: string[] = [];

  for (const skill of sourceSkills) {
    const targetDir = path.join(targetRoot, skill.name);
    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.cp(skill.dir, targetDir, { recursive: true });
    copied.push(skill.name);
  }

  const removed: string[] = [];
  if (options.removeExtra) {
    const workspaceSkills = await findSkillDirs(targetRoot);
    for (const skill of workspaceSkills) {
      if (!sourceSkills.some((entry) => entry.name === skill.name)) {
        await fs.rm(skill.dir, { recursive: true, force: true });
        removed.push(skill.name);
      }
    }
  }

  bumpSkillsSnapshotVersion({ workspaceDir, reason: "manual" });

  return { copied, removed };
}

async function findSkillDirs(root: string): Promise<Array<{ name: string; dir: string }>> {
  try {
    const stats = await fs.stat(root);
    if (!stats.isDirectory()) return [];
  } catch {
    return [];
  }

  const entries = await fs.readdir(root, { withFileTypes: true });
  const skills: Array<{ name: string; dir: string }> = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    try {
      await fs.access(path.join(dir, "SKILL.md"));
      skills.push({ name: entry.name, dir });
    } catch {
      continue;
    }
  }
  return skills;
}
