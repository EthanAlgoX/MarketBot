import fs from "node:fs/promises";
import path from "node:path";

import type { MarketBotConfig } from "../config/types.js";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agentScope.js";
import { resolveManagedSkillsDir } from "./paths.js";
import { loadSkills } from "./registry.js";
import { parseSkillMetadata } from "./eligibility/parser.js";
import { checkEligibility } from "./eligibility/checker.js";
import { resolveAllowlist, resolveDenylist, resolveSkillConfig } from "./config.js";

export interface SkillStatusEntry {
  name: string;
  description?: string;
  emoji?: string;
  filePath: string;
  source: string;
  skillKey: string;
  disabled: boolean;
  eligible: boolean;
  blockedByAllowlist: boolean;
  invocation?: ReturnType<typeof parseSkillMetadata>["invocation"];
  commands?: ReturnType<typeof parseSkillMetadata>["commands"];
  install?: ReturnType<typeof parseSkillMetadata>["install"];
  requirements: ReturnType<typeof parseSkillMetadata>["requirements"];
  missing: ReturnType<typeof checkEligibility>["missing"];
}

export interface SkillStatusReport {
  skills: SkillStatusEntry[];
  workspaceDir: string;
  managedSkillsDir: string;
}

export async function buildSkillStatus(
  config: MarketBotConfig,
  options: { agentId?: string; cwd?: string } = {},
): Promise<SkillStatusReport> {
  const agentId = options.agentId ?? resolveDefaultAgentId(config);
  const cwd = options.cwd ?? process.cwd();
  const workspaceDir = resolveAgentWorkspaceDir(config, agentId, cwd);
  const managedSkillsDir = resolveManagedSkillsDir(config);

  const skills = await loadSkills(config, agentId, cwd);
  const entries: SkillStatusEntry[] = [];

  for (const skill of skills) {
    const content = skill.content ?? (await readSkillContent(skill.location));
    const metadata = parseSkillMetadata(content, skill.name);
    const skillKey = metadata.skillKey ?? metadata.name;
    const skillConfig = resolveSkillConfig(config, skillKey);
    const eligibility = checkEligibility(metadata.requirements, {
      allowlist: resolveAllowlist(config),
      denylist: resolveDenylist(config),
      envOverrides: skillConfig?.env,
      configOverrides: skillConfig?.config,
      primaryEnv: metadata.primaryEnv,
      apiKey: skillConfig?.apiKey,
      skillKey,
      skillName: metadata.name,
    });
    const disabled = skillConfig?.enabled === false;
    const always = metadata.always === true;

    entries.push({
      name: metadata.name,
      description: metadata.description,
      emoji: metadata.emoji,
      filePath: skill.location,
      source: resolveSkillSource(skill.location, workspaceDir, managedSkillsDir),
      skillKey,
      disabled,
      eligible: disabled ? false : always ? !eligibility.blockedByAllowlist : eligibility.eligible,
      blockedByAllowlist: eligibility.blockedByAllowlist,
      invocation: metadata.invocation,
      commands: metadata.commands,
      install: metadata.install,
      requirements: metadata.requirements,
      missing: always ? { bins: [], anyBins: [], env: [], os: [], config: [] } : eligibility.missing,
    });
  }

  return {
    skills: entries,
    workspaceDir,
    managedSkillsDir,
  };
}

async function readSkillContent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function resolveSkillSource(filePath: string, workspaceDir: string, managedDir: string): string {
  if (filePath.startsWith(path.join(workspaceDir, "skills"))) return "workspace";
  if (filePath.startsWith(managedDir)) return "managed";
  return "external";
}
