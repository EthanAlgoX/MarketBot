import fs from "node:fs/promises";
import path from "node:path";

import type { MarketBotConfig } from "../config/types.js";
import { resolveAgentWorkspaceDir } from "../agents/agentScope.js";
import { resolveManagedSkillsDir } from "./paths.js";

export interface SkillEntry {
  name: string;
  description?: string;
  location: string;
  sourceDir: string;
  content?: string;
}

export interface SkillLoadOptions {
  maxCharsPerSkill?: number;
  maxSkills?: number;
}

export async function loadSkills(
  config: MarketBotConfig,
  agentId: string,
  cwd: string = process.cwd(),
  options: SkillLoadOptions = {},
): Promise<SkillEntry[]> {
  const enabled = config.skills?.enabled ?? true;
  if (!enabled) return [];

  const maxChars = options.maxCharsPerSkill ?? config.skills?.maxCharsPerSkill ?? 1200;
  const maxSkills = options.maxSkills ?? config.skills?.maxSkills ?? 20;

  const skillDirs = resolveSkillDirs(config, agentId, cwd);
  const entries: SkillEntry[] = [];

  for (const dir of skillDirs) {
    const skills = await readSkillsFromDir(dir, maxChars);
    entries.push(...skills);
    if (entries.length >= maxSkills) break;
  }

  return entries.slice(0, maxSkills);
}

export function resolveSkillDirs(config: MarketBotConfig, agentId: string, cwd: string): string[] {
  const dirs: string[] = [];
  const workspaceDir = resolveAgentWorkspaceDir(config, agentId, cwd);
  dirs.push(path.join(workspaceDir, "skills"));

  dirs.push(resolveManagedSkillsDir(config));

  const envDirs =
    (process.env.MARKETBOT_SKILLS_DIRS ?? process.env.TRADEBOT_SKILLS_DIRS)?.split(",") ?? [];
  for (const dir of envDirs.map((value) => value.trim()).filter(Boolean)) {
    dirs.push(dir);
  }

  const configDirs = config.skills?.directories ?? [];
  for (const dir of configDirs.map((value) => value.trim()).filter(Boolean)) {
    dirs.push(dir);
  }

  return Array.from(new Set(dirs));
}

async function readSkillsFromDir(dir: string, maxChars: number): Promise<SkillEntry[]> {
  try {
    const stats = await fs.stat(dir);
    if (!stats.isDirectory()) return [];
  } catch {
    return [];
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const skills: SkillEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(dir, entry.name);
    const skillPath = path.join(skillDir, "SKILL.md");
    try {
      const content = await fs.readFile(skillPath, "utf8");
      const parsed = parseSkillContent(content, entry.name);
      skills.push({
        name: parsed.name,
        description: parsed.description,
        location: skillPath,
        sourceDir: dir,
        content: truncate(content, maxChars),
      });
    } catch {
      continue;
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function parseSkillContent(content: string, fallbackName: string): { name: string; description?: string } {
  const trimmed = content.trim();
  if (trimmed.startsWith("---")) {
    const end = trimmed.indexOf("\n---", 3);
    if (end !== -1) {
      const frontMatter = trimmed.slice(3, end).trim();
      const meta = parseFrontMatter(frontMatter);
      const name = meta.name ?? fallbackName;
      return { name, description: meta.description };
    }
  }

  const heading = trimmed.split("\n").find((line) => line.startsWith("# "));
  if (heading) {
    return { name: heading.replace(/^#\s+/, "").trim(), description: undefined };
  }

  return { name: fallbackName };
}

function parseFrontMatter(block: string): { name?: string; description?: string } {
  const meta: { name?: string; description?: string } = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^([a-zA-Z_]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2]?.trim();
    if (key === "name") meta.name = value;
    if (key === "description") meta.description = value;
  }
  return meta;
}

function truncate(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars)}\n...[truncated]`;
}
