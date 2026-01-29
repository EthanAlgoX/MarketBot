import { BASE_SYSTEM_PROMPT } from "../prompts/systemPrompt.js";
import { loadConfig } from "../config/io.js";
import { normalizeAgentId, resolveAgentWorkspaceDir, resolveDefaultAgentId } from "./agentScope.js";
import { ensureWorkspace, readWorkspaceContext } from "./workspace.js";
import { loadSkills } from "../skills/registry.js";

const cachedPrompts = new Map<string, string>();

export interface SystemPromptOptions {
  cwd?: string;
  agentId?: string;
}

export async function getSystemPrompt(options: SystemPromptOptions = {}): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const config = await loadConfig(cwd);
  const agentId = normalizeAgentId(options.agentId ?? resolveDefaultAgentId(config));
  const cacheKey = `${cwd}::${agentId}`;
  const cached = cachedPrompts.get(cacheKey);
  if (cached) return cached;

  await ensureWorkspace(config, agentId, cwd);
  const workspaceDir = resolveAgentWorkspaceDir(config, agentId, cwd);
  const skills = await loadSkills(config, agentId, cwd);
  const skillsBlock = skills.length
    ? [
        "",
        "## Skills",
        ...skills.map((skill) => {
          const description = skill.description ? ` - ${skill.description}` : "";
          const content = skill.content ? `\n${skill.content}` : "";
          return `### ${skill.name}${description}\n${skill.location}${content}`;
        }),
        "",
      ].join("\n")
    : "";

  const contextFiles = await readWorkspaceContext(workspaceDir);
  const contextBlock = contextFiles.length
    ? [
        "",
        "## Workspace Context",
        ...contextFiles.map((entry) => `### ${entry.name}\n${entry.content}`),
        "",
      ].join("\n")
    : "";

  const prompt = `${BASE_SYSTEM_PROMPT}${skillsBlock}${contextBlock}`;
  cachedPrompts.set(cacheKey, prompt);
  return prompt;
}

export function clearSystemPromptCache() {
  cachedPrompts.clear();
}
