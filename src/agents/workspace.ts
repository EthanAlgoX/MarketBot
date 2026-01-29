import fs from "node:fs/promises";
import path from "node:path";

import type { MarketBotConfig } from "../config/types.js";
import { resolveAgentWorkspaceDir } from "./agentScope.js";
import {
  DEFAULT_AGENTS_CONTENT,
  DEFAULT_BOOTSTRAP_CONTENT,
  DEFAULT_IDENTITY_CONTENT,
  DEFAULT_SOUL_CONTENT,
  DEFAULT_TOOLS_CONTENT,
  DEFAULT_USER_CONTENT,
} from "./templates.js";

export const DEFAULT_AGENTS_FILENAME = "AGENTS.md";
export const DEFAULT_SOUL_FILENAME = "SOUL.md";
export const DEFAULT_TOOLS_FILENAME = "TOOLS.md";
export const DEFAULT_IDENTITY_FILENAME = "IDENTITY.md";
export const DEFAULT_USER_FILENAME = "USER.md";
export const DEFAULT_BOOTSTRAP_FILENAME = "BOOTSTRAP.md";

export interface WorkspacePaths {
  dir: string;
  agentsPath: string;
  soulPath: string;
  toolsPath: string;
  identityPath: string;
  userPath: string;
  bootstrapPath: string;
}

export async function ensureWorkspace(
  config: MarketBotConfig,
  agentId?: string,
  cwd: string = process.cwd(),
): Promise<WorkspacePaths> {
  const resolvedAgentId = agentId ?? "main";
  const workspaceDir = resolveAgentWorkspaceDir(config, resolvedAgentId, cwd);
  await fs.mkdir(workspaceDir, { recursive: true });

  const ensureBootstrap = config.agents?.defaults?.ensureBootstrap ?? true;
  if (!ensureBootstrap) {
    return {
      dir: workspaceDir,
      agentsPath: path.join(workspaceDir, DEFAULT_AGENTS_FILENAME),
      soulPath: path.join(workspaceDir, DEFAULT_SOUL_FILENAME),
      toolsPath: path.join(workspaceDir, DEFAULT_TOOLS_FILENAME),
      identityPath: path.join(workspaceDir, DEFAULT_IDENTITY_FILENAME),
      userPath: path.join(workspaceDir, DEFAULT_USER_FILENAME),
      bootstrapPath: path.join(workspaceDir, DEFAULT_BOOTSTRAP_FILENAME),
    };
  }

  const agentsPath = path.join(workspaceDir, DEFAULT_AGENTS_FILENAME);
  const soulPath = path.join(workspaceDir, DEFAULT_SOUL_FILENAME);
  const toolsPath = path.join(workspaceDir, DEFAULT_TOOLS_FILENAME);
  const identityPath = path.join(workspaceDir, DEFAULT_IDENTITY_FILENAME);
  const userPath = path.join(workspaceDir, DEFAULT_USER_FILENAME);
  const bootstrapPath = path.join(workspaceDir, DEFAULT_BOOTSTRAP_FILENAME);

  const isBrandNewWorkspace = await isWorkspaceEmpty([
    agentsPath,
    soulPath,
    toolsPath,
    identityPath,
    userPath,
  ]);

  await writeFileIfMissing(agentsPath, DEFAULT_AGENTS_CONTENT);
  await writeFileIfMissing(soulPath, DEFAULT_SOUL_CONTENT);
  await writeFileIfMissing(toolsPath, DEFAULT_TOOLS_CONTENT);
  await writeFileIfMissing(identityPath, DEFAULT_IDENTITY_CONTENT);
  await writeFileIfMissing(userPath, DEFAULT_USER_CONTENT);
  if (isBrandNewWorkspace) {
    await writeFileIfMissing(bootstrapPath, DEFAULT_BOOTSTRAP_CONTENT);
  }

  return {
    dir: workspaceDir,
    agentsPath,
    soulPath,
    toolsPath,
    identityPath,
    userPath,
    bootstrapPath,
  };
}

export async function readWorkspaceContext(workspaceDir: string): Promise<Array<{ name: string; content: string }>> {
  const files = [
    DEFAULT_AGENTS_FILENAME,
    DEFAULT_SOUL_FILENAME,
    DEFAULT_TOOLS_FILENAME,
    DEFAULT_IDENTITY_FILENAME,
    DEFAULT_USER_FILENAME,
  ];

  const entries: Array<{ name: string; content: string }> = [];
  for (const name of files) {
    const filePath = path.join(workspaceDir, name);
    try {
      const content = await fs.readFile(filePath, "utf8");
      const trimmed = content.trim();
      if (!trimmed) continue;
      entries.push({ name, content: trimmed });
    } catch {
      // skip missing
    }
  }
  return entries;
}

async function writeFileIfMissing(filePath: string, content: string) {
  try {
    await fs.writeFile(filePath, content, { encoding: "utf8", flag: "wx" });
  } catch (err) {
    const anyErr = err as { code?: string };
    if (anyErr.code !== "EEXIST") throw err;
  }
}

async function isWorkspaceEmpty(pathsToCheck: string[]): Promise<boolean> {
  const existing = await Promise.all(
    pathsToCheck.map(async (filePath) => {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    }),
  );
  return existing.every((value) => !value);
}
