import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

import type { MarketBotConfig } from "../config/types.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agentScope.js";
import { resolveManagedSkillsDir } from "./paths.js";
import { bumpSkillsSnapshotVersion } from "./refresh.js";

export interface InstallSkillOptions {
  source: string;
  name?: string;
  scope?: "managed" | "workspace";
  agentId?: string;
  cwd?: string;
  force?: boolean;
}

export interface RemoveSkillOptions {
  name: string;
  scope?: "managed" | "workspace";
  agentId?: string;
  cwd?: string;
}

export async function installSkill(config: MarketBotConfig, options: InstallSkillOptions): Promise<string[]> {
  const scope = options.scope ?? "managed";
  const cwd = options.cwd ?? process.cwd();
  const agentId = options.agentId ?? resolveDefaultAgentId(config);

  if (scope === "workspace" && !options.agentId) {
    throw new Error("Workspace scope requires --agent <id>.");
  }

  const workspaceDir = scope === "workspace" ? resolveAgentWorkspaceDir(config, agentId, cwd) : undefined;
  const targetRoot = scope === "workspace"
    ? path.join(workspaceDir!, "skills")
    : resolveManagedSkillsDir(config);

  await fs.mkdir(targetRoot, { recursive: true });

  const { dir: sourceDir, cleanup } = await stageSource(options.source, cwd);
  try {
    const installed = await copySkillSource(sourceDir, targetRoot, {
      name: options.name,
      force: options.force ?? false,
    });
    if (scope === "workspace" && workspaceDir) {
      bumpSkillsSnapshotVersion({ workspaceDir, reason: "manual" });
    } else {
      bumpSkillsSnapshotVersion({ reason: "manual" });
    }
    return installed;
  } finally {
    await cleanup();
  }
}

export async function removeSkill(config: MarketBotConfig, options: RemoveSkillOptions): Promise<string> {
  const scope = options.scope ?? "managed";
  const cwd = options.cwd ?? process.cwd();
  const agentId = options.agentId ?? resolveDefaultAgentId(config);

  const workspaceDir = scope === "workspace" ? resolveAgentWorkspaceDir(config, agentId, cwd) : undefined;
  const targetRoot = scope === "workspace"
    ? path.join(workspaceDir!, "skills")
    : resolveManagedSkillsDir(config);

  const dir = path.join(targetRoot, options.name);
  await fs.rm(dir, { recursive: true, force: true });

  if (scope === "workspace" && workspaceDir) {
    bumpSkillsSnapshotVersion({ workspaceDir, reason: "manual" });
  } else {
    bumpSkillsSnapshotVersion({ reason: "manual" });
  }

  return dir;
}

async function stageSource(source: string, cwd: string): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const trimmed = source.trim();
  if (isGitSource(trimmed)) {
    const tempDir = path.join(os.tmpdir(), `marketbot-skill-${randomUUID()}`);
    await fs.mkdir(tempDir, { recursive: true });
    await runCommand("git", ["clone", "--depth", "1", trimmed, tempDir], { cwd });
    return {
      dir: tempDir,
      cleanup: async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
      },
    };
  }

  const resolved = path.isAbsolute(trimmed) ? trimmed : path.join(cwd, trimmed);
  return { dir: resolved, cleanup: async () => {} };
}

async function copySkillSource(
  sourceDir: string,
  targetRoot: string,
  opts: { name?: string; force: boolean },
): Promise<string[]> {
  const skillFiles = await findSkillDirs(sourceDir);
  if (skillFiles.length === 0) {
    throw new Error("No SKILL.md found in source.");
  }

  if (opts.name && skillFiles.length > 1) {
    throw new Error("--name cannot be used when installing multiple skills.");
  }

  const installed: string[] = [];
  for (const entry of skillFiles) {
    const skillName = opts.name ?? entry.name;
    const targetDir = path.join(targetRoot, skillName);

    if (!opts.force) {
      const exists = await pathExists(targetDir);
      if (exists) {
        throw new Error(`Skill already exists: ${skillName}`);
      }
    }

    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.cp(entry.dir, targetDir, { recursive: true });
    installed.push(skillName);
  }

  return installed;
}

async function findSkillDirs(root: string): Promise<Array<{ name: string; dir: string }>> {
  const direct = path.join(root, "SKILL.md");
  try {
    await fs.access(direct);
    return [{ name: path.basename(root), dir: root }];
  } catch {
    // continue
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

function isGitSource(value: string): boolean {
  if (value.startsWith("git@")) return true;
  if (value.startsWith("https://") && value.endsWith(".git")) return true;
  if (value.startsWith("https://") && value.includes("github.com")) return true;
  return false;
}

function runCommand(command: string, args: string[], opts: { cwd: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: opts.cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}
