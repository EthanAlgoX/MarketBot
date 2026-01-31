import type { MarketBotConfig } from "../config/types.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { ToolResult } from "../tools/types.js";
import { buildToolContext } from "../tools/context.js";
import { isToolAllowed, resolveToolPolicy } from "../tools/policy.js";
import { appendToolLog } from "../tools/toolLogging.js";
import { buildSkillStatus, type SkillStatusEntry } from "./status.js";

export interface RunSkillCommandOptions {
  skill: string;
  command: string;
  rawArgs: string;
  agentId?: string;
  cwd?: string;
  registry: ToolRegistry;
}

export async function runSkillCommand(
  config: MarketBotConfig,
  options: RunSkillCommandOptions,
): Promise<ToolResult> {
  const report = await buildSkillStatus(config, {
    agentId: options.agentId,
    cwd: options.cwd,
  });

  const target = resolveSkill(report.skills, options.skill);
  if (!target) {
    throw new Error(`Skill not found: ${options.skill}`);
  }

  if (target.disabled) {
    throw new Error(`Skill is disabled: ${target.name}`);
  }

  if (target.blockedByAllowlist) {
    throw new Error(`Skill is blocked by allowlist/denylist: ${target.name}`);
  }

  if (!target.eligible) {
    throw new Error(`Skill is not eligible: ${target.name}`);
  }

  const command = target.commands?.find((cmd) => cmd.name === options.command);
  if (!command || !command.dispatch) {
    throw new Error(`Command not found or missing dispatch: ${options.command}`);
  }

  if (target.invocation?.userInvocable === false) {
    throw new Error(`Command is not user-invocable: ${target.name}`);
  }

  if (command.dispatch.kind !== "tool") {
    throw new Error(`Unsupported dispatch kind: ${command.dispatch.kind}`);
  }

  const tool = options.registry.get(command.dispatch.toolName);
  if (!tool) {
    throw new Error(`Tool not registered: ${command.dispatch.toolName}`);
  }

  const allTools = options.registry.list().map((entry) => entry.name);
  const policy = resolveToolPolicy(config, options.agentId);
  if (!isToolAllowed(tool.name, policy, allTools)) {
    throw new Error(`Tool not allowed by policy: ${tool.name}`);
  }

  const context = buildToolContext(options.rawArgs, options.cwd, options.agentId);
  const startedAt = Date.now();
  try {
    const result = await tool.run(context);
    await appendToolLog({
      name: tool.name,
      ok: result.ok,
      durationMs: Date.now() - startedAt,
      input: options.rawArgs,
      output: result.output,
    }, context);
    return result;
  } catch (err) {
    await appendToolLog({
      name: tool.name,
      ok: false,
      durationMs: Date.now() - startedAt,
      input: options.rawArgs,
      error: err instanceof Error ? err.message : String(err),
    }, context);
    throw err;
  }
}

function resolveSkill(
  skills: SkillStatusEntry[],
  query: string,
): SkillStatusEntry | undefined {
  const normalized = query.toLowerCase();
  return skills.find(
    (skill) => skill.name.toLowerCase() === normalized || skill.skillKey.toLowerCase() === normalized,
  );
}
