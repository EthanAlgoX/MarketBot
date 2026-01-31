import { BASE_SYSTEM_PROMPT } from "../core/prompts/systemPrompt.js";
import { loadConfig } from "../config/io.js";
import { normalizeAgentId, resolveAgentWorkspaceDir, resolveDefaultAgentId } from "./agentScope.js";
import { ensureWorkspace, readWorkspaceContext } from "./workspace.js";
import { loadSkills } from "../skills/registry.js";
import { buildSkillStatus } from "../skills/status.js";
import { ensureSkillsWatcher, getSkillsSnapshotVersion } from "../skills/refresh.js";
import { createDefaultToolRegistry } from "../tools/registry.js";
import { resolveToolAllowlist, resolveToolPolicy } from "../tools/policy.js";

const cachedPrompts = new Map<string, string>();

export interface SystemPromptOptions {
  cwd?: string;
  agentId?: string;
}

export async function getSystemPrompt(options: SystemPromptOptions = {}): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig(cwd);
  const agentId = normalizeAgentId(options.agentId ?? resolveDefaultAgentId(config));

  await ensureWorkspace(config, agentId, cwd);
  const workspaceDir = resolveAgentWorkspaceDir(config, agentId, cwd);

  ensureSkillsWatcher({ config, agentId, cwd });
  const version = getSkillsSnapshotVersion(workspaceDir);
  const cacheKey = `${cwd}::${agentId}::${version}`;
  const cached = cachedPrompts.get(cacheKey);
  if (cached) return cached;

  const toolsBlock = await buildToolsBlock(config, agentId);

  const statusReport = await buildSkillStatus(config, { agentId, cwd });
  const eligiblePaths = new Set(
    statusReport.skills
      .filter((entry) => entry.eligible && !entry.disabled && !entry.blockedByAllowlist)
      .map((entry) => entry.filePath),
  );
  const skills = (await loadSkills(config, agentId, cwd)).filter((skill) =>
    eligiblePaths.has(skill.location),
  );
  const skillsBlock = skills.length ? buildSkillsBlock(skills) : "";

  const contextFiles = await readWorkspaceContext(workspaceDir);
  const contextBlock = contextFiles.length
    ? [
      "## Workspace Context",
      ...contextFiles.map((entry) => `### ${entry.name}\n${entry.content}`),
    ].join("\n\n")
    : "";

  const workspaceBlock = `## Workspace\n${workspaceDir}`;
  const runtimeBlock = buildRuntimeBlock();

  const promptSections = [
    BASE_SYSTEM_PROMPT,
    toolsBlock,
    skillsBlock,
    workspaceBlock,
    runtimeBlock,
    contextBlock,
  ].filter(Boolean);

  const prompt = promptSections.join("\n\n");
  cachedPrompts.set(cacheKey, prompt);
  return prompt;
}

export function clearSystemPromptCache() {
  cachedPrompts.clear();
}

async function buildToolsBlock(config: Awaited<ReturnType<typeof loadConfig>>, agentId: string): Promise<string> {
  const registry = await createDefaultToolRegistry();
  const tools = registry.list();
  const policy = resolveToolPolicy(config, agentId);
  const allowlist = resolveToolAllowlist(policy, tools.map((tool) => tool.name));
  const allowSet = new Set(allowlist.map((name) => name.toLowerCase()));
  const allowedTools = tools.filter((tool) => allowSet.has(tool.name.toLowerCase()));
  if (allowedTools.length === 0) {
    return "## Tools\n- (no tools allowed by policy)";
  }
  const lines = ["## Tools"];
  for (const tool of allowedTools) {
    const description = tool.description ? ` - ${tool.description}` : "";
    lines.push(`- ${tool.name}${description}`);
  }
  return lines.join("\n");
}

function buildSkillsBlock(skills: Array<{ name: string; description?: string; location: string }>): string {
  const lines = ["## Skills"];
  for (const skill of skills) {
    const description = skill.description ? ` - ${skill.description}` : "";
    lines.push(`- ${skill.name}${description} (location: ${skill.location})`);
  }
  return lines.join("\n");
}

function buildRuntimeBlock(): string {
  const node = process.version;
  const platform = process.platform;
  const arch = process.arch;
  return `## Runtime\nnode ${node} (${platform}/${arch})`;
}
